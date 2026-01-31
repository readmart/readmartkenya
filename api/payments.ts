import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, badRequest, serverError, createNotification, calculateOrderCommissions, logAction } from './_utils.js';
import {
  verifyK2Signature,
  extractK2WebhookData,
  initiateK2StkPush,
  getK2TransactionStatus,
  registerK2Webhook,
  getK2CallbackUrl,
  K2_EVENT_TYPES,
  getK2Token,
  createK2PayRecipient,
  initiateK2Payment
} from './_payments.js';
import { sendEmail, renderOrderConfirmationEmail, renderFailedPaymentEmail } from './_email.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers are handled by vercel.json

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = req.url || '';
    const query = req.query || {};
    const action = query.action as string || (url.includes('init') ? 'init' : url.includes('webhook') ? 'webhook' : url.includes('status') ? 'status' : '');
    const method = req.method;

    const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

    // --- WEBHOOK ENDPOINT ---
    if (action === 'webhook' || query.webhook === 'true' || url.includes('webhook')) {
      if (method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
      
      const signature = (req.headers['x-kopokopo-signature'] || req.headers['x-k2-signature']) as string;
      const payload = req.body;
      const queryOrderId = req.query.orderId as string;
      
      console.log('--- Webhook Received ---', JSON.stringify(payload));
      
      if (!verifyK2Signature(payload, signature)) {
        console.error('Invalid K2 signature');
        // In production, we MUST reject this.
        if (isProduction) return json(res, 401, { error: 'Invalid signature' });
      }

      const webhookData = extractK2WebhookData(payload);
      const { webhookEventId, transactionId, amount, phone, eventType, senderName, status, currency } = webhookData;
      
      // The orderId can come from metadata OR from the query parameter in the callback URL
      const orderId = webhookData.orderId || queryOrderId;
      
      if (queryOrderId) console.log(`Found OrderId ${queryOrderId} in query parameters`);
      if (webhookData.orderId) console.log(`Found OrderId ${webhookData.orderId} in webhook metadata`);

      // Determine if this is a transaction event or a reversal
      const isTransactionEvent = [
        K2_EVENT_TYPES.STK_PUSH_SUCCESS, 
        K2_EVENT_TYPES.BUYGOODS_RECEIVED, 
        K2_EVENT_TYPES.PAYBILL_RECEIVED,
        K2_EVENT_TYPES.CARD_RECEIVED,
        K2_EVENT_TYPES.B2B_RECEIVED,
        K2_EVENT_TYPES.M_PESA_PAYMENT_RECEIVED,
        'incoming_payment',
        'buygoods_transaction_received',
        'card_transaction_received',
        'paybill_transaction_received',
        'm-pesa_payment_received',
        'Buygoods Transaction' // From user sample event.type
      ].includes(eventType) || 
      eventType?.includes('payment_received') || 
      eventType?.includes('transaction_received');

      const isReversalEvent = [
        K2_EVENT_TYPES.CARD_VOIDED,
        K2_EVENT_TYPES.CARD_REVERSED,
        K2_EVENT_TYPES.BUYGOODS_REVERSED,
        'card_transaction_voided',
        'card_transaction_reversed',
        'buygoods_transaction_reversed'
      ].includes(eventType) || 
      eventType?.includes('reversed') || 
      eventType?.includes('voided');

      console.log(`Processing ${eventType}: OrderId=${orderId}, Success=${webhookData.isSuccess}, Status=${status}, Transaction=${transactionId}, WebhookEventId=${webhookEventId}`);
      
      // Handle SMS Notification Result (Asynchronous result of sendK2SmsNotification)
      if (eventType === 'transaction_sms_notification') {
        console.log(`K2 SMS Notification Result: ${status} for event ${webhookData.webhookEventId}`);
        // We could log this to a table if we want to track SMS delivery
        return json(res, 200, { received: true });
      }

      if (orderId && (isTransactionEvent || isReversalEvent)) {
        // --- IDEMPOTENCY CHECK ---
        // 1. Check if this specific webhook event has been processed
        const { data: existingProcessedEvent } = await supabase
          .from('transactions')
          .select('id')
          .contains('metadata', { webhook_event_id: webhookEventId })
          .maybeSingle();

        if (existingProcessedEvent) {
          console.log(`Webhook event ${webhookEventId} already processed. Skipping.`);
          return json(res, 200, { received: true, already_processed: true });
        }

        // 2. Check if the order is already paid (for non-reversal events)
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('payment_status, is_paid, payment_id')
          .eq('id', orderId)
          .maybeSingle();

        if (existingOrder?.is_paid && !isReversalEvent) {
          console.log(`Order ${orderId} is already marked as paid. Skipping redundant webhook.`);
          return json(res, 200, { received: true, already_processed: true });
        }

        const isSuccess = webhookData.isSuccess;
        const actuallyPaid = isSuccess && !isReversalEvent;
        const finalStatus = isReversalEvent ? 'reversed' : (isSuccess ? 'paid' : 'failed');
        
        const isMembership = orderId.startsWith('MEMB-');
        
        if (isMembership) {
            console.log(`Processing membership payment for order ${orderId}, status: ${finalStatus}`);
            
            // --- IDEMPOTENCY CHECK FOR MEMBERSHIP ---
            const { data: existingMemb } = await supabase
              .from('membership_payments')
              .select('status')
              .or(`payment_id.eq.${transactionId},metadata->>order_id.eq.${orderId}`)
              .maybeSingle();

            if (existingMemb?.status === 'completed' && actuallyPaid) {
              console.log(`Membership payment ${orderId} already completed. Skipping.`);
              return json(res, 200, { received: true, already_processed: true });
            }

            // 1. Update membership_payments table
            const { data: membershipPayments, error: membError } = await supabase
              .from('membership_payments')
              .update({ 
                status: isReversalEvent ? 'reversed' : (actuallyPaid ? 'completed' : 'failed'),
                payment_id: transactionId,
                metadata: { ...payload, webhook_event_id: webhookEventId, updated_at: new Date().toISOString() }
              })
              .or(`payment_id.eq.${transactionId},payment_id.ilike.%${transactionId}%,metadata->>order_id.eq.${orderId}`)
              .select();

            if (membError) console.error('Membership update error:', membError);

            if (actuallyPaid && (membershipPayments?.length || 0) > 0) {
              const payment = membershipPayments![0];
              const userId = payment.user_id;

              // Send SMS notification if webhookEventId exists
              if (webhookEventId) {
                const smsMessage = `Confirmed. Your membership payment of ${currency} ${amount || payment.amount} has been received. Your ReadMart account is now active!`;
                await sendK2SmsNotification(webhookEventId, smsMessage);
              }

              const metadata = payment.metadata || {};
              const isClubMembership = metadata.type === 'club_membership';
              const clubId = metadata.club_id;

              if (isClubMembership && clubId) {
                console.log(`Activating club membership for user ${userId} in club ${clubId}`);
                
                // Update club_members table
                await supabase.from('club_members').upsert({
                  user_id: userId,
                  club_id: clubId,
                  payment_status: 'paid',
                  status: 'active',
                  joined_at: new Date().toISOString()
                }, { onConflict: 'user_id, club_id' });

                // Create notification
                await createNotification({
                  userId,
                  type: 'system',
                  title: 'Club Access Unlocked!',
                  message: `Welcome to the club! Your membership payment was successful.`,
                  link: `/community`
                });
              } else {
                // 2. Update profile to member status (Site-wide)
                const { data: settings } = await supabase.from('site_settings').select('membership_duration_days').maybeSingle();
                const duration = settings?.membership_duration_days || 30;
                
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + duration);

                await supabase.from('profiles').update({
                  is_member: true,
                  membership_started_at: new Date().toISOString(),
                  membership_expires_at: expiresAt.toISOString()
                }).eq('id', userId);

                // 3. Create notification
                await createNotification({
                  userId,
                  type: 'system',
                  title: 'Membership Activated!',
                  message: `Welcome to ReadMart Premium! Your membership is now active until ${expiresAt.toLocaleDateString()}.`,
                  link: '/account'
                });
              }
            }
          } else {
            console.log(`Updating order ${orderId} status to ${finalStatus}`);
            const updatePayload: any = { 
              status: finalStatus,
              payment_status: finalStatus,
              is_paid: actuallyPaid,
              payment_metadata: payload 
            };
            
            if (transactionId) {
              updatePayload.payment_id = transactionId;
              updatePayload.mpesa_receipt_number = transactionId;
            }
            
            const { data: updatedOrders, error: orderError } = await supabase
              .from('orders')
              .update(updatePayload)
              .eq('id', orderId)
              .select();

            if (orderError) throw orderError;

            if (updatedOrders && updatedOrders.length > 0) {
              const order = updatedOrders[0];
              
              // Log transaction
              await supabase.from('transactions').insert([{
                order_id: order.id,
                user_id: order.user_id,
                amount: amount || order.total_amount,
                status: actuallyPaid ? 'completed' : (isReversalEvent ? 'reversed' : 'failed'),
                provider_reference: transactionId,
                metadata: { ...payload, webhook_event_id: webhookEventId }
              }]);

              if (actuallyPaid) {
                // Send SMS notification if webhookEventId exists (as per K2 docs)
                if (webhookEventId) {
                  const smsMessage = `Confirmed. We have received your payment of ${currency} ${amount || order.total_amount} for Order #${order.id.slice(0, 8)}. Thank you for shopping with ReadMart!`;
                  await sendK2SmsNotification(webhookEventId, smsMessage);
                }

                // The database trigger public.tr_order_paid_commissions will handle 
                // calculateOrderCommissions(order.id) automatically when is_paid = true.
                
                await logAction(req, order.user_id, 'payment_received', 'orders', { orderId: order.id, amount });
                
                // Fetch items with product type and ebook metadata to check for digital-only order
                const { data: items } = await supabase
                  .from('order_items')
                  .select(`
                    *,
                    product:products(
                      type,
                      metadata
                    )
                  `)
                  .eq('order_id', order.id);

                // Check if this is a digital-only order (all items are ebooks)
                const isDigitalOnly = items && items.length > 0 && items.every((item: any) => 
                  item.product?.type === 'ebook' || item.product_snapshot?.type === 'ebook'
                );

                if (isDigitalOnly) {
                  console.log(`Order ${order.id} is digital-only. Marking as completed.`);
                  await supabase
                    .from('orders')
                    .update({ status: 'completed' })
                    .eq('id', order.id);
                }

                // Notifications
                if (order.user_id) {
                  await createNotification({
                    userId: order.user_id,
                    type: 'order',
                    title: 'Payment Received!',
                    message: `Your payment of KES ${order.total_amount} for order #${order.id.slice(0, 8).toUpperCase()} was successful.${isDigitalOnly ? ' Your ebooks are now available.' : ''}`,
                    link: isDigitalOnly ? '/account?tab=ebooks' : `/account?tab=orders`
                  });
                }

                // Email
                try {
                  const email = order.shipping_address?.email;
                  if (email) {
                    const processedItems = (items as any[])?.map(item => ({
                      ...item,
                      is_ebook: item.product?.is_ebook || item.product?.type === 'ebook' || item.product_snapshot?.type === 'ebook',
                      ebook_password: item.product?.metadata?.ebook_password || item.product_snapshot?.metadata?.ebook_password || (item as any).ebook_password
                    }));

                    const html = renderOrderConfirmationEmail({ order, items: processedItems || [] });
                    const forwardingEmail = process.env.FORWARDING_EMAIL;
                    
                    await sendEmail({
                      to: email,
                      bcc: forwardingEmail, // Keep admin informed of new paid orders
                      subject: `Order Confirmed - #${order.id.slice(0, 8).toUpperCase()}`,
                      html
                    });
                  }
                } catch (e) {
                  console.error('Email failed:', e);
                }
              } else {
                // Send failed payment email
                try {
                  const email = order.shipping_address?.email;
                  if (email) {
                    const html = renderFailedPaymentEmail({ order });
                    await sendEmail({
                      to: email,
                      subject: `Payment Failed - #${order.id.slice(0, 8).toUpperCase()}`,
                      html
                    });
                  }
                } catch (e) {
                  console.error('Failed payment email failed:', e);
                }
              }
            }
          }
        }
      }
      
      return json(res, 200, { received: true });
    }

    // --- INIT PAYMENT ---
    if (action === 'init' || url.includes('init')) {
      if (method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
      const { orderId, phone, amount, firstName, lastName, email, type, metadata, paymentMethod } = req.body || {};
      
      const isMembership = type === 'membership' || type === 'club_membership' || type === 'site_membership';
      if (!isMembership && (!orderId || !phone || !amount)) return badRequest(res, 'Missing payment details');
      if (isMembership && (!phone || !amount)) return badRequest(res, 'Missing phone or amount for membership');

      try {
        const token = req.headers.authorization?.split(' ')[1] || '';
        let user = null;
        if (token) {
          try {
            const { data: userData, error: userError } = await supabase.auth.getUser(token);
            if (!userError && userData?.user) {
              user = userData.user;
            }
          } catch (e) {
            console.warn('Auth check failed, continuing as guest:', e);
          }
        }
        
        const finalOrderId = orderId || `MEMB-${user?.id?.slice(0, 8) || 'GUEST'}-${Date.now()}`;

        let k2Result;
        
        if (paymentMethod === 'card') {
          // KopoKopo Hosted Checkout is a common way to handle card payments.
          // The URL format is usually https://app.kopokopo.com/pay/[till_number]
          // or a specific checkout URL provided by KopoKopo.
          const tillNumber = process.env.KOPOKOPO_TILL_NUMBER;
          const checkoutBaseUrl = isProduction 
            ? 'https://app.kopokopo.com/pay' 
            : 'https://sandbox.kopokopo.com/pay';
          
          const checkoutUrl = `${checkoutBaseUrl}/${tillNumber}`;
          
          k2Result = {
            status: 'Pending',
            message: 'Please complete the card payment on the following page',
            location: `${checkoutUrl}?reference=${finalOrderId}`,
            payment_method: 'card'
          };
          
          console.log(`Card payment initiated for order ${finalOrderId}. Redirecting to ${k2Result.location}`);
        } else {
          // Default to M-Pesa STK Push
          k2Result = await initiateK2StkPush({
            phone,
            amount,
            orderId: finalOrderId,
            firstName,
            lastName,
            email,
          });
        }

        // Update appropriate table with payment request location for polling
        const paymentId = k2Result.location || (k2Result as any).id;
        let dbRecordId = null;
        
        if (isMembership && user) {
          const { data: membRecord } = await supabase.from('membership_payments').insert([{
            user_id: user.id,
            amount,
            status: 'pending',
            payment_id: paymentId,
            metadata: { ...k2Result, type, ...(metadata || {}) }
          }]).select('id').single();
          dbRecordId = membRecord?.id;
        } else if (orderId) {
          const updatePayload: any = { 
            payment_metadata: k2Result 
          };
          if (paymentId) updatePayload.payment_id = paymentId;
          await supabase.from('orders').update(updatePayload).eq('id', orderId);
        }

        return json(res, 200, { ...k2Result, db_id: dbRecordId });
      } catch (err: any) {
        if (isProduction) {
          // In production, we don't use demo mode
          throw err;
        }

        if (err.message.includes('credentials') || err.message.includes('configured')) {
          console.warn('Payment credentials missing, using demo response');
          
          // FOR DEMO: Automatically complete the order/membership
          const { orderId, type, metadata } = req.body;
          const isMembership = type === 'membership' || type === 'club_membership' || type === 'site_membership';
          
          if (!isMembership && orderId) {
            console.log(`Demo mode: Fulfilling order ${orderId}`);
            // Update order to paid
            await supabase.from('orders').update({ 
              status: 'paid',
              is_paid: true,
              payment_status: 'paid'
            }).eq('id', orderId);
            // Trigger commission calculation (will be handled by trigger if is_paid updated, 
            // but we call it explicitly here for immediate effect in demo)
            await calculateOrderCommissions(orderId);
          } else if (isMembership) {
            const token = req.headers.authorization?.split(' ')[1] || '';
          const { data: userData } = await supabase.auth.getUser(token);
          const user = userData?.user;
          if (user) {
              if (type === 'club_membership' && metadata?.club_id) {
                console.log(`Demo mode: Activating club membership for user ${user.id} in club ${metadata.club_id}`);
                await supabase.from('club_members').upsert({
                  user_id: user.id,
                  club_id: metadata.club_id,
                  payment_status: 'paid',
                  status: 'active',
                  joined_at: new Date().toISOString()
                }, { onConflict: 'user_id, club_id' });
              } else {
                console.log(`Demo mode: Activating membership for user ${user.id}`);
                const { data: settings } = await supabase.from('site_settings').select('membership_duration_days').maybeSingle();
                const duration = settings?.membership_duration_days || 30;
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + duration);
                
                await supabase.from('profiles').update({
                  is_member: true,
                  membership_started_at: new Date().toISOString(),
                  membership_expires_at: expiresAt.toISOString()
                }).eq('id', user.id);
              }
            }
          }

          return json(res, 200, { demo: true, message: 'Demo mode active - Order automatically fulfilled' });
        }
        throw err;
      }
    }

    // --- STATUS CHECK ---
    if (action === 'status' || url.includes('status')) {
      const { id } = req.query;
      if (!id) return badRequest(res, 'Missing transaction ID');
      try {
        const result = await getK2TransactionStatus(id as string);
        return json(res, 200, result);
      } catch (err: any) {
        if (isProduction) {
          throw err;
        }
        if (err.message.includes('credentials') || err.message.includes('configured')) {
          return json(res, 200, { status: 'pending', demo: true });
        }
        throw err;
      }
    }

    // --- REGISTER WEBHOOKS (ADMIN ONLY) ---
    if (action === 'register-webhooks' || url.includes('register-webhooks')) {
      try {
        const token = req.headers.authorization?.split(' ')[1] || '';
        const { data: userData, error: authError } = await supabase.auth.getUser(token);
        const user = userData?.user;
        
        if (!user) return unauthorized(res, 'Authentication required');
        
        // Check if admin
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
          
        if (profile?.role !== 'admin' && profile?.role !== 'founder') {
          return unauthorized(res, 'Admin access required');
        }

        const callbackUrl = getK2CallbackUrl();
        const eventTypes = [
          'incoming_payment',
          'buygoods_transaction_received',
          'buygoods_transaction_reversed',
          'customer_created',
          'settlement_transfer_completed',
          'transaction_sms_notification'
        ];

        const results = [];
        for (const eventType of eventTypes) {
          try {
            const result = await registerK2Webhook(eventType, callbackUrl);
            results.push({ eventType, status: 'success', data: result });
          } catch (e: any) {
            results.push({ eventType, status: 'error', error: e.message });
          }
        }

        return json(res, 200, { 
          message: 'Webhook registration process completed',
          callbackUrl,
          results 
        });
      } catch (err) {
        return serverError(res, err);
      }
    }

    // --- CREATE PAY RECIPIENT (ADMIN ONLY) ---
    if (action === 'create-recipient') {
      try {
        const token = req.headers.authorization?.split(' ')[1] || '';
        const { data: userData } = await supabase.auth.getUser(token);
        const user = userData?.user;
        if (!user) return unauthorized(res);

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role !== 'admin' && profile?.role !== 'founder') return unauthorized(res);

        const result = await createK2PayRecipient(req.body);
        return json(res, result.success ? 201 : 400, result);
      } catch (err) {
        return serverError(res, err);
      }
    }

    // --- INITIATE OUTGOING PAYMENT (ADMIN ONLY) ---
    if (action === 'send-money') {
      try {
        const token = req.headers.authorization?.split(' ')[1] || '';
        const { data: userData } = await supabase.auth.getUser(token);
        const user = userData?.user;
        if (!user) return unauthorized(res);

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role !== 'admin' && profile?.role !== 'founder') return unauthorized(res);

        const result = await initiateK2Payment(req.body);
        return json(res, result.success ? 201 : 400, result);
      } catch (err) {
        return serverError(res, err);
      }
    }

    return json(res, 404, { error: 'Not found' });
  } catch (err) {
    return serverError(res, err);
  }
}
