import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, badRequest, serverError, createNotification, calculateOrderCommissions, logAction } from './_utils.js';
import {
  verifyK2Signature,
  extractK2WebhookData,
  initiateK2StkPush,
  getK2TransactionStatus,
  K2_EVENT_TYPES,
  getK2Token
} from './_payments.js';
import { sendEmail, renderOrderConfirmationEmail, renderFailedPaymentEmail } from './_email.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers manually if needed, or rely on vercel.json
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-kopokopo-signature, x-k2-signature');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = req.url || '';
    const method = req.method;

    // --- WEBHOOK ENDPOINT ---
    if (url.includes('webhook')) {
      if (method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
      
      const signature = (req.headers['x-kopokopo-signature'] || req.headers['x-k2-signature']) as string;
      const payload = req.body;
      const queryOrderId = req.query.orderId as string;
      
      console.log('--- Webhook Received ---', JSON.stringify(payload));
      
      if (!verifyK2Signature(payload, signature)) {
        console.error('Invalid K2 signature');
        // In production, we should reject this. In sandbox/dev, we might be more lenient but still log it.
        const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
        if (isProduction) return json(res, 401, { error: 'Invalid signature' });
      }

      const webhookData = extractK2WebhookData(payload);
      const { transactionId, amount, phone, eventType, senderName, status } = webhookData;
      const orderId = webhookData.orderId || queryOrderId;

      // Handle card payments or other transaction types where status might be 'Received'
      const isSuccess = webhookData.isSuccess;
      
      console.log(`Processing webhook: Event=${eventType}, OrderId=${orderId}, Success=${isSuccess}, Status=${status}, Transaction=${transactionId}`);
      
      if (orderId) {
        // Handle STK Push results (incoming_payment) and other transaction events
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
          'm-pesa_payment_received'
        ].includes(eventType) || 
        eventType?.includes('payment_received') || 
        eventType?.includes('transaction_received') ||
        (eventType === 'incoming_payment' && status === 'Success');

        const isReversalEvent = [
          K2_EVENT_TYPES.CARD_VOIDED,
          K2_EVENT_TYPES.CARD_REVERSED,
          K2_EVENT_TYPES.BUYGOODS_REVERSED,
          'card_transaction_voided',
          'card_transaction_reversed',
          'buygoods_transaction_reversed'
        ].includes(eventType) || eventType?.includes('reversed') || eventType?.includes('voided');

        if (isTransactionEvent || isReversalEvent) {
          const finalStatus = isReversalEvent ? 'reversed' : (isSuccess ? 'paid' : 'failed');
          
          // For K2, sometimes 'Received' or 'Success' or 'Completed' means success
          const actuallyPaid = isSuccess && !isReversalEvent;
          const isMembership = orderId.startsWith('MEMB-');
          
          if (isMembership) {
            console.log(`Processing membership payment for order ${orderId}, status: ${finalStatus}`);
            
            // 1. Update membership_payments table
            const { data: membershipPayments, error: membError } = await supabase
              .from('membership_payments')
              .update({ 
                status: isReversalEvent ? 'reversed' : (actuallyPaid ? 'completed' : 'failed'),
                payment_id: transactionId,
                metadata: { ...payload, updated_at: new Date().toISOString() }
              })
              .or(`payment_id.eq.${transactionId},payment_id.ilike.%${transactionId}%,metadata->>order_id.eq.${orderId}`)
              .select();

            if (membError) console.error('Membership update error:', membError);

            if (actuallyPaid && (membershipPayments?.length || 0) > 0) {
              const payment = membershipPayments![0];
              const userId = payment.user_id;
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
                metadata: payload
              }]);

              if (actuallyPaid) {
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
                    await sendEmail({
                      to: email,
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
    if (url.includes('init')) {
      if (method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
      const { orderId, phone, amount, firstName, lastName, email, type, metadata, paymentMethod } = req.body;
      
      const isMembership = type === 'membership' || type === 'club_membership' || type === 'site_membership';
      if (!isMembership && (!orderId || !phone || !amount)) return badRequest(res, 'Missing payment details');
      if (isMembership && (!phone || !amount)) return badRequest(res, 'Missing phone or amount for membership');

      try {
        const { data: { user } } = await supabase.auth.getUser(req.headers.authorization?.split(' ')[1] || '');
        const finalOrderId = orderId || `MEMB-${user?.id?.slice(0, 8)}-${Date.now()}`;

        let k2Result;
        
        if (paymentMethod === 'card') {
          // For card payments, we might return a hosted link or just a success message 
          // if we're using a different flow. Since the K2 doc provided doesn't show 
          // card initiation API, we'll return a simulated success/redirect for now
          // or a message that card is handled via the app.
          k2Result = {
            status: 'Pending',
            message: 'Please complete the card payment on the following page',
            location: `https://checkout.kopokopo.com/pay/readmart?reference=${finalOrderId}`, // Simulated
            payment_method: 'card'
          };
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
            const { data: { user } } = await supabase.auth.getUser(req.headers.authorization?.split(' ')[1] || '');
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
    if (url.includes('status')) {
      const { id } = req.query;
      if (!id) return badRequest(res, 'Missing transaction ID');
      try {
        const result = await getK2TransactionStatus(id as string);
        return json(res, 200, result);
      } catch (err: any) {
        if (err.message.includes('credentials') || err.message.includes('configured')) {
          return json(res, 200, { status: 'pending', demo: true });
        }
        throw err;
      }
    }

    return json(res, 404, { error: 'Not found' });
  } catch (err) {
    return serverError(res, err);
  }
}
