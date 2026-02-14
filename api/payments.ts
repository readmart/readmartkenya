import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, badRequest, unauthorized, serverError, createNotification, logAction } from './_utils.js';
import {
  verifyK2Signature,
  extractK2WebhookData,
  initiateK2StkPush,
  getK2TransactionStatus,
  registerK2Webhook,
  listK2Webhooks,
  getK2CallbackUrl,
  K2_EVENT_TYPES,
  createK2PayRecipient,
  initiateK2Payment,
  sendK2SmsNotification
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

      // KopoKopo signs the raw JSON request body with HMAC-SHA256 using the API key.
      const signature =
        (req.headers['x-kopokopo-signature'] as string | undefined) ||
        (req.headers['x-k2-signature'] as string | undefined) ||
        (req.headers['x-kopokopo-signature'.toLowerCase()] as string | undefined) ||
        null;

      const payload = req.body;
      const bodyString =
        typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
      const queryOrderId = req.query.orderId as string;
      
      console.log('--- Webhook Received ---', JSON.stringify(payload));
      
      const debugWebhooks = !isProduction && process.env.K2_WEBHOOK_DEBUG === 'true';

      if (!verifyK2Signature(bodyString, signature)) {
        console.error('Invalid K2 signature');
        // In production, we MUST reject this. In non-prod we only allow bypass
        // when explicitly enabled for debugging.
        if (isProduction || !debugWebhooks) {
          return json(res, 401, { error: 'Invalid signature' });
        }
      }

      const webhookData = extractK2WebhookData(payload);
      const { webhookEventId, transactionId, amount, eventType, status, currency } = webhookData;
      
      // The orderId can come from metadata OR from the query parameter in the callback URL
      const orderId = webhookData.orderId || queryOrderId;
      
      if (queryOrderId) console.log(`Found OrderId ${queryOrderId} in query parameters`);
      if (webhookData.orderId) console.log(`Found OrderId ${webhookData.orderId} in webhook metadata`);

      // High-level audit log for incoming K2 webhook
      await logAction(req, null, 'k2_webhook_received', 'payments', {
        eventType,
        webhookEventId,
        transactionId,
        orderId,
        status,
      });

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
      
      // --- B2C PAYOUT HANDLING ---
      if (eventType === K2_EVENT_TYPES.B2C_PAYMENT_SUCCESS || 
          eventType === K2_EVENT_TYPES.B2C_PAYMENT_FAILED || 
          eventType === 'payment_result') {
        
        console.log(`Processing B2C payout result: ${status} for transaction ${transactionId}`);
        
        // Extract fulfillment_id from metadata if available
        const fulfillmentId = payload.data?.attributes?.metadata?.fulfillment_id || 
                            payload.data?.attributes?.metadata?.fulfillment_ledger_id;
        
        if (fulfillmentId) {
          const isSuccess = status === 'Sent' || eventType === K2_EVENT_TYPES.B2C_PAYMENT_SUCCESS;
          const finalPayoutStatus = isSuccess ? 'paid' : 'failed';
          
          try {
            const { error: updateError } = await supabase
              .from('fulfillment_ledger')
              .update({ 
                payout_status: finalPayoutStatus,
                metadata: { 
                  ...(payload.data?.attributes?.metadata || {}), 
                  webhook_event_id: webhookEventId,
                  k2_transaction_id: transactionId,
                  updated_at: new Date().toISOString()
                }
              })
              .eq('id', fulfillmentId);
            
            if (updateError) {
              console.error(`Failed to update fulfillment ledger ${fulfillmentId}:`, updateError);
            } else {
              console.log(`Successfully updated fulfillment ledger ${fulfillmentId} to ${finalPayoutStatus}`);
            }
          } catch (e) {
            console.error(`Exception updating fulfillment ledger ${fulfillmentId}:`, e);
          }
        } else {
          console.warn('B2C payout webhook received but no fulfillment_id found in metadata');
        }
        
        return json(res, 200, { received: true });
      }

      // Handle SMS Notification Result (Asynchronous result of sendK2SmsNotification)
      if (eventType === 'transaction_sms_notification') {
        console.log(`K2 SMS Notification Result: ${status} for event ${webhookData.webhookEventId}`);
        // We could log this to a table if we want to track SMS delivery
        return json(res, 200, { received: true });
      }

      if (orderId && (isTransactionEvent || isReversalEvent)) {
        // --- IDEMPOTENCY CHECK ---
        // 1. Check if this specific transaction has been processed
        let existingProcessedEvent: any = null;
        let processedError: any = null;

        try {
          // Attempt to check idempotency if provider_reference exists
          const { data, error } = await supabase
            .from('transactions')
            .select('id')
            .eq('provider_reference', transactionId)
            .maybeSingle();
          
          if (error && error.code !== '42703') { // 42703 is undefined_column
            processedError = error;
          } else if (data) {
            existingProcessedEvent = data;
          }
        } catch (e: any) {
          // If it's a column missing error, we just proceed
          if (e.code !== '42703') processedError = e;
        }

        if (processedError) {
          if (processedError.code === 'PGRST204' || processedError.message?.includes('cache')) {
            console.warn('Transactions schema cache issue, falling back to basic select');
            try {
              const { data: retryData } = await supabase
                .from('transactions')
                .select('id')
                .eq('id', transactionId) // Fallback to id if provider_reference is missing
                .maybeSingle();
              existingProcessedEvent = retryData;
            } catch (e) {}
          } else {
            console.error('Error checking idempotency:', processedError);
          }
        }

        if (existingProcessedEvent) {
          console.log(`Webhook event ${webhookEventId} already processed. Skipping.`);
          return json(res, 200, { received: true, already_processed: true });
        }

        // --- IDEMPOTENCY CHECK 2 ---
        // Check if a transaction with this reference already exists in the transactions table
        // This is a second layer of defense
        if (transactionId) {
          try {
            const { data: txByRef } = await supabase
              .from('transactions')
              .select('id')
              .eq('provider_reference', transactionId)
              .maybeSingle();
            
            if (txByRef) {
              console.log(`Transaction ${transactionId} already exists in transactions table. Skipping.`);
              return json(res, 200, { received: true, already_processed: true });
            }
          } catch (e) {
            // Ignore error here
          }
        }

        // 2. Check if the order is already paid (for non-reversal events)
        let existingOrder: any = null;
        let orderError: any = null;

        try {
          const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .maybeSingle();
          existingOrder = data;
          orderError = error;
        } catch (e: any) {
          orderError = e;
        }

        if (orderError) {
          if (orderError.code === 'PGRST204' || orderError.message?.includes('cache') || orderError.message?.includes('column')) {
            console.warn('Orders schema cache issue in webhook, falling back to core columns');
            const { data: retryOrder } = await supabase
              .from('orders')
              .select('id, status, total_amount')
              .eq('id', orderId)
              .maybeSingle();
            existingOrder = retryOrder;
          }
        }

            const orderIsPaid = existingOrder?.status === 'paid' || existingOrder?.status === 'processing' || existingOrder?.status === 'completed';
        if (orderIsPaid && !isReversalEvent) {
          console.log(`Order ${orderId} is already marked as paid. Skipping redundant webhook.`);
          return json(res, 200, { received: true, already_processed: true });
        }

        const isSuccess = webhookData.isSuccess;
        const actuallyPaid = isSuccess && !isReversalEvent;
        // Map KopoKopo status to ReadMart order status
        // valid statuses: 'pending', 'paid', 'processing', 'completed', 'cancelled'
        const finalStatus = isReversalEvent ? 'cancelled' : (isSuccess ? 'paid' : 'cancelled');
        
        const isMembership = orderId.startsWith('MEMB-');
        
        if (isMembership) {
            console.log(`Processing membership payment for order ${orderId}, status: ${finalStatus}`);
            
            // --- IDEMPOTENCY CHECK FOR MEMBERSHIP ---
            let existingMemb: any = null;
            let membCheckError: any = null;

            try {
              const { data, error } = await supabase
                .from('membership_payments')
                .select('status')
                .or(`payment_id.eq.${transactionId},metadata->>order_id.eq.${orderId}`)
                .maybeSingle();
              existingMemb = data;
              membCheckError = error;
            } catch (e: any) {
              membCheckError = e;
            }

            if (membCheckError) {
              if (membCheckError.code === 'PGRST204' || membCheckError.message?.includes('cache')) {
                console.warn('Membership schema cache issue, falling back to core columns');
                const { data: retryMemb } = await supabase
                  .from('membership_payments')
                  .select('status')
                  .eq('payment_id', transactionId)
                  .maybeSingle();
                existingMemb = retryMemb;
              }
            }

            if (existingMemb?.status === 'completed' && actuallyPaid) {
              console.log(`Membership payment ${orderId} already completed. Skipping.`);
              return json(res, 200, { received: true, already_processed: true });
            }

            // 1. Update membership_payments table
            let membershipPayments: any[] | null = null;
            let membError: any = null;

            try {
              const { data, error } = await supabase
                .from('membership_payments')
                .update({ 
                  status: isReversalEvent ? 'reversed' : (actuallyPaid ? 'completed' : 'failed'),
                  payment_id: transactionId,
                  metadata: { ...payload, webhook_event_id: webhookEventId, updated_at: new Date().toISOString() }
                })
                .or(`payment_id.eq.${transactionId},payment_id.ilike.%${transactionId}%,metadata->>order_id.eq.${orderId}`)
                .select('id, user_id, amount, status, metadata');
              membershipPayments = data;
              membError = error;
            } catch (e: any) {
              membError = e;
            }

            if (membError) {
              if (membError.code === 'PGRST204' || membError.message?.includes('cache')) {
                console.warn('Membership update schema cache issue, retrying with minimal select');
                const { data: retryData } = await supabase
                  .from('membership_payments')
                  .update({ 
                    status: isReversalEvent ? 'reversed' : (actuallyPaid ? 'completed' : 'failed'),
                    payment_id: transactionId
                  })
                  .eq('payment_id', transactionId)
                  .select('id, user_id, amount, status');
                membershipPayments = retryData;
              } else {
                console.error('Membership update error:', membError);
              }
            }

            if (membershipPayments && membershipPayments.length > 0) {
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
                
                // Update book_club_members table
                try {
                  const { error: clubError } = await supabase.from('book_club_members').upsert({
                    user_id: userId,
                    club_id: clubId,
                    status: 'active',
                    joined_at: new Date().toISOString()
                  }, { onConflict: 'user_id, club_id' });

                  if (clubError) {
                    if (clubError.code === 'PGRST204' || clubError.message?.includes('cache')) {
                      console.warn('Book club members schema cache issue, retrying minimal upsert');
                      await supabase.from('book_club_members').upsert({
                        user_id: userId,
                        club_id: clubId,
                        status: 'active'
                      }, { onConflict: 'user_id, club_id' });
                    } else {
                      throw clubError;
                    }
                  }
                } catch (e) {
                  console.error('Failed to update book club membership:', e);
                }

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
                let duration = 30;
                try {
                  const { data: settings, error: settingsError } = await supabase
                    .from('site_settings')
                    .select('membership_duration_days')
                    .maybeSingle();
                  
                  if (!settingsError && settings) {
                    duration = settings.membership_duration_days || 30;
                  }
                } catch (e) {
                  console.warn('Failed to fetch site settings for membership duration, using default 30 days');
                }
                
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + duration);

                try {
                  const { error: profileError } = await supabase.from('profiles').update({
                    is_member: true,
                    membership_started_at: new Date().toISOString(),
                    membership_expires_at: expiresAt.toISOString()
                  }).eq('id', userId);
                  
                  if (profileError) {
                    if (profileError.code === 'PGRST204' || profileError.message?.includes('cache')) {
                      console.warn('Profiles schema cache issue during membership update, retrying with minimal update');
                      // Retry without the new columns if they are causing the issue
                      await supabase.from('profiles').update({
                        is_member: true
                      }).eq('id', userId);
                    } else {
                      throw profileError;
                    }
                  }
                } catch (e) {
                  console.error('Failed to update user profile for membership:', e);
                }

                // 3. Create notification
                await createNotification({
                  userId,
                  type: 'system',
                  title: 'Membership Activated!',
                  message: `Welcome to ReadMart Premium! Your membership is now active until ${expiresAt.toLocaleDateString()}.`,
                  link: '/account'
                });
              }

              // Log membership transaction for observability
              try {
                const txPayload: any = {
                  order_id: null,
                  user_id: userId,
                  amount: amount || payment.amount,
                  status: actuallyPaid ? 'completed' : 'failed'
                };
                
                // Add columns only if they are likely to exist
                const { error: membTxError } = await supabase.from('transactions').insert([txPayload]);
                
                if (membTxError) {
                  if (membTxError.code === '42703') {
                    // Undefined column, already tried minimal
                    console.warn('Transactions table missing columns, logged minimal transaction');
                  } else {
                    console.error('Failed to log membership transaction:', membTxError);
                  }
                }
              } catch (e) {
                console.error('Membership transaction logging exception:', e);
              }
            }
          } else {
            console.log(`Updating order ${orderId} status to ${finalStatus}`);
            const updatePayload: any = { 
              status: finalStatus,
              payment_metadata: payload 
            };
            
            if (transactionId) {
              updatePayload.payment_id = transactionId;
            }
            
            let updatedOrders: any = null;
            let orderError: any = null;

            try {
              const { data, error } = await supabase
                .from('orders')
                .update(updatePayload)
                .eq('id', orderId)
                .select('id, user_id, total_amount, shipping_address, status');
              updatedOrders = data;
              orderError = error;
            } catch (e: any) {
              orderError = e;
            }

            if (orderError) {
              if (orderError.code === 'PGRST204' || orderError.message?.includes('cache') || orderError.message?.includes('column')) {
                console.warn('Orders schema cache issue during update, retrying with minimal payload');
                
                // If it's a column error, try to identify which one and remove it
                const match = orderError.message.match(/column ['"](.+)['"]/) || orderError.message.match(/['"](.+)['"] column/);
                if (match && match[1]) {
                  const missingCol = match[1];
                  delete updatePayload[missingCol];
                } else if (orderError.message.includes('status')) {
                  delete updatePayload.status;
                }
                
                const { error: retryError } = await supabase
                  .from('orders')
                  .update(updatePayload)
                  .eq('id', orderId)
                  .select('id');
                
                if (retryError) throw retryError;
                
                // Fetch the rest of the data we need for notification/email
                const { data: fullOrder } = await supabase
                  .from('orders')
                  .select('id, user_id, total_amount, shipping_address, status')
                  .eq('id', orderId)
                  .single();
                
                updatedOrders = fullOrder ? [fullOrder] : null;
              } else {
                throw orderError;
              }
            }

            if (updatedOrders && updatedOrders.length > 0) {
              const order = updatedOrders[0];
              
              // Log transaction
              try {
                const { error: txError } = await supabase.from('transactions').insert([{
                  order_id: order.id,
                  user_id: order.user_id,
                  amount: amount || (order as any).total_amount,
                  status: actuallyPaid ? 'completed' : (isReversalEvent ? 'failed' : 'failed'),
                  provider_reference: transactionId,
                  metadata: { ...payload }
                }]);

                if (txError) {
                  if (txError.code === 'PGRST204' || txError.message?.includes('cache')) {
                    console.warn('Transactions schema cache issue, retrying minimal insert');
                    await supabase.from('transactions').insert([{
                      order_id: order.id,
                      amount: amount || (order as any).total_amount,
                      status: actuallyPaid ? 'completed' : (isReversalEvent ? 'reversed' : 'failed')
                    }]);
                  }
                }
              } catch (e) {
                console.error('Failed to log transaction:', e);
              }

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
                let items: any[] = [];
                try {
                  const { data, error } = await supabase
                    .from('order_items')
                    .select('id, order_id, product_id, quantity')
                    .eq('order_id', order.id);
                  
                  if (error) {
                    if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
                      console.warn('Schema cache issue in order_items fetch, retrying with minimal select');
                      const { data: fallbackItems, error: fallbackError } = await supabase
                        .from('order_items')
                        .select('id, product_id, quantity')
                        .eq('order_id', order.id);
                      
                      if (fallbackError) throw fallbackError;

                      // For each fallback item, try to get product info individually to handle joins failing
                      const enrichedItems = await Promise.all((fallbackItems || []).map(async (item) => {
                        try {
                          const { data: productData } = await supabase
                            .from('products')
                            .select('id, type, metadata')
                            .eq('id', item.product_id)
                            .maybeSingle();
                          return { ...item, product: productData };
                        } catch (e) {
                          return item;
                        }
                      }));
                      items = enrichedItems;
                    } else {
                      throw error;
                    }
                  } else {
                    items = data || [];
                  }
                } catch (e) {
                  console.error('Failed to fetch order items for post-payment processing:', e);
                }

                // Check if this is a digital-only order (all items are ebooks)
                const isDigitalOnly = items && items.length > 0 && items.every((item: any) => 
                  item.product?.type === 'ebook' || item.product?.category === 'Digital'
                );

                if (isDigitalOnly) {
                  console.log(`Order ${order.id} is digital-only. Marking as completed.`);
                  try {
                    const { error: completeError } = await supabase
                      .from('orders')
                      .update({ status: 'completed' })
                      .eq('id', order.id);
                    
                    if (completeError) {
                      if (completeError.code === 'PGRST204' || completeError.message?.includes('cache')) {
                        console.warn('Orders schema cache issue during completion, retrying');
                        await supabase
                          .from('orders')
                          .update({ status: 'completed' })
                          .eq('id', order.id);
                      }
                    }
                  } catch (e) {
                    console.error('Failed to mark digital order as completed:', e);
                  }
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
        console.log(`Webhook processing complete for order ${orderId || 'unknown'}`);
        return json(res, 200, { received: true });
      }

    // --- INIT PAYMENT ---
    if (action === 'init' || url.includes('init')) {
      if (method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
      const { orderId, phone, amount, firstName, lastName, email, type, metadata, paymentMethod } = req.body || {};
      
      const isMembership = type === 'membership' || type === 'club_membership' || type === 'site_membership';
      
      // Validation with better error reporting
      if (!isMembership && (!orderId || !phone || !amount)) {
        console.error('Missing standard payment details:', { orderId, phone, amount });
        return badRequest(res, `Missing payment details: ${!orderId ? 'orderId' : ''} ${!phone ? 'phone' : ''} ${!amount ? 'amount' : ''}`.trim());
      }
      if (isMembership && (!phone || !amount)) {
        console.error('Missing membership payment details:', { phone, amount });
        return badRequest(res, `Missing phone or amount for membership`);
      }

      let finalOrderId = orderId || `MEMB-GUEST-${Date.now()}`;

      try {
        const token = req.headers.authorization?.split(' ')[1] || '';
        let user = null;
        if (token) {
          try {
            const { data: userData, error: userError } = await supabase.auth.getUser(token);
            if (!userError && userData?.user) {
              user = userData.user;
              if (!orderId) {
                finalOrderId = `MEMB-${user.id.slice(0, 8)}-${Date.now()}`;
              }
            }
          } catch (e) {
            console.warn('Auth check failed, continuing as guest:', e);
          }
        }
        console.log(`Initiating ${paymentMethod || 'm-pesa'} payment for ${isMembership ? 'membership' : 'order ' + finalOrderId}`);
        console.log(`Amount: ${amount}, Phone: ${phone}`);
        
        let k2Result;
        
        if (paymentMethod === 'card') {
          // ... (card logic)
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
          try {
            // Generate dynamic callback URL based on current host if possible
            const host = req.headers.host || 'readmartke.com';
            const protocol = host.includes('localhost') ? 'http' : 'https';
            const dynamicCallbackUrl = `${protocol}://${host}/api/kopokopo/webhook?orderId=${finalOrderId}`;
            
            console.log(`Using callback URL: ${dynamicCallbackUrl}`);

            k2Result = await initiateK2StkPush({
              phone,
              amount,
              orderId: finalOrderId,
              firstName,
              lastName,
              email,
              callbackUrl: dynamicCallbackUrl
            });
            console.log('K2 STK Push Result:', JSON.stringify(k2Result));
          } catch (stkError: any) {
            console.error('K2 STK Push Initiation Failed:', stkError);
            throw stkError;
          }
        }

        // Update appropriate table with payment request location for polling
        const paymentId = k2Result?.location || (k2Result as any)?.id;
        let dbRecordId = null;
        
        if (isMembership && user) {
          try {
            const { data: membRecord, error: insertError } = await supabase.from('membership_payments').insert([{
              user_id: user.id,
              amount,
              status: 'pending',
              payment_id: paymentId,
              metadata: { ...k2Result, type, ...(metadata || {}) }
            }]).select('id').single();
            
            if (insertError) {
              if (insertError.code === 'PGRST204' || insertError.message?.includes('cache')) {
                console.warn('Membership payments schema cache issue, retrying minimal insert');
                const { data: retryMemb } = await supabase.from('membership_payments').insert([{
                  user_id: user.id,
                  amount,
                  status: 'pending'
                }]).select('id').single();
                dbRecordId = retryMemb?.id;
              } else {
                console.error('Failed to insert membership payment record:', insertError);
              }
            } else {
              dbRecordId = membRecord?.id;
            }
          } catch (e) {
            console.error('Critical failure in membership payment insertion:', e);
          }
        } else if (orderId) {
          const updatePayload: any = { 
            payment_metadata: k2Result 
          };
          if (paymentId) updatePayload.payment_id = paymentId;
          try {
            const { error: updateError } = await supabase.from('orders').update(updatePayload).eq('id', orderId);
            if (updateError) {
              if (updateError.code === 'PGRST204' || updateError.message?.includes('cache')) {
                console.warn('Orders schema cache issue during payment init update, retrying');
                await supabase.from('orders').update({ payment_id: paymentId }).eq('id', orderId);
              } else {
                console.error('Failed to update order with payment info:', updateError);
              }
            }
          } catch (e) {
            console.error('Critical failure in order payment init update:', e);
          }
        }

        return json(res, 200, { ...k2Result, db_id: dbRecordId });
      } catch (err: any) {
        console.error('Payment Init Error Handler:', err);
        
        const isConfigError = err.message.includes('credentials') || err.message.includes('configured');
        const isK2Error = err.message.includes('K2') || err.message.includes('token') || err.message.includes('Status');

        if (isProduction) {
          // In production, we don't use demo mode
          console.error(`Production Payment Error [${finalOrderId}]:`, err.message, err.stack);
          
          if (isConfigError) {
            return json(res, 503, { 
              error: 'Payment Configuration Error', 
              message: err.message,
              code: 'CONFIG_ERROR'
            });
          }
          
          if (isK2Error) {
             return json(res, 503, { 
              error: 'Payment Provider Error', 
              message: err.message,
              code: 'PROVIDER_ERROR'
            });
          }

          return json(res, 500, {
            error: 'Internal Server Error',
            message: err.message || 'An unexpected error occurred during payment initiation',
            code: 'SERVER_ERROR'
          });
        }

        // Non-production: return structured error; never auto-fulfill (removed demo mode for production safety)
        if (isConfigError) {
          return json(res, 503, {
            error: 'Payment Configuration Error',
            message: err.message,
            code: 'CONFIG_ERROR'
          });
        }
        if (isK2Error) {
          return json(res, 503, {
            error: 'Payment Provider Error',
            message: err.message,
            code: 'PROVIDER_ERROR'
          });
        }
        return json(res, 500, {
          error: 'Internal Server Error',
          message: err.message || 'An unexpected error occurred during payment initiation',
          code: 'SERVER_ERROR'
        });
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
        const { data: userData } = await supabase.auth.getUser(token);
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

    // --- DISBURSE PAYOUTS (ADMIN ONLY) ---
    if (action === 'disburse') {
      try {
        const token = req.headers.authorization?.split(' ')[1] || '';
        const { data: userData } = await supabase.auth.getUser(token);
        const user = userData?.user;
        if (!user) return unauthorized(res);

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role !== 'admin' && profile?.role !== 'founder') return unauthorized(res);

        // 1. Fetch pending payouts
        // Hardened: Fetch ledger entries directly to avoid PGRST200 relationship issues
        const { data: payouts, error: payoutError } = await supabase
          .from('fulfillment_ledger')
          .select('*')
          .eq('payout_status', 'pending')
          .limit(10); // Process in small batches

        if (payoutError) throw payoutError;
        if (!payouts || payouts.length === 0) return json(res, 200, { message: 'No pending payouts' });

        // Manually fetch related profiles (partners)
        const partnerIds = [...new Set(payouts.map((p: any) => p.partner_id).filter(Boolean))];
        let partnersMap: Record<string, any> = {};
        
        if (partnerIds.length > 0) {
          const { data: partnersData } = await supabase
            .from('profiles')
            .select('id, full_name, email, k2_recipient_id')
            .in('id', partnerIds);
          
          if (partnersData) {
            partnersMap = partnersData.reduce((acc: any, p: any) => {
              acc[p.id] = p;
              return acc;
            }, {});
          }
        }

        const results = [];

        for (const payout of payouts) {
          try {
            const partner = payout.partner_id ? partnersMap[payout.partner_id] : null;
            if (!partner) {
              results.push({ id: payout.id, status: 'error', error: 'Partner profile not found' });
              continue;
            }

            // 2. Get payment method
            const { data: paymentMethod } = await supabase
              .from('payment_methods')
              .select('identifier')
              .eq('user_id', partner.id)
              .eq('type', 'mpesa')
              .eq('is_default', true)
              .maybeSingle();

            if (!paymentMethod) {
              results.push({ id: payout.id, status: 'error', error: 'No default M-Pesa payment method found' });
              continue;
            }

            // 3. Ensure recipient exists in K2
            let recipientId = partner.k2_recipient_id;
            if (!recipientId) {
              const recipientResult = await createK2PayRecipient({
                type: 'mobile_wallet',
                pay_recipient: {
                  firstName: partner.full_name?.split(' ')[0] || 'Partner',
                  lastName: partner.full_name?.split(' ').slice(1).join(' ') || 'User',
                  email: partner.email,
                  phone: paymentMethod.identifier,
                  network: 'Safaricom'
                }
              });

              if (recipientResult.success && recipientResult.location) {
                recipientId = recipientResult.location.split('/').pop();
                // Cache it
                await supabase.from('profiles').update({ k2_recipient_id: recipientId } as any).eq('id', partner.id);
              } else {
                results.push({ id: payout.id, status: 'error', error: 'Failed to create K2 recipient: ' + recipientResult.error });
                continue;
              }
            }

            // 4. Initiate Payment
            const paymentResult = await initiateK2Payment({
              destination_type: 'mobile_wallet',
              destination_reference: recipientId,
              amount: { currency: 'KES', value: Number(payout.amount) },
              description: `Payout for Order #${payout.order_id.slice(0,8)}`,
              metadata: {
                fulfillment_id: payout.id,
                partner_id: partner.id
              }
            });

            if (paymentResult.success) {
              // Update status to processing
              await supabase.from('fulfillment_ledger').update({ 
                payout_status: 'processing',
                metadata: { ...(payout.metadata as any || {}), k2_location: paymentResult.location }
              }).eq('id', payout.id);
              
              results.push({ id: payout.id, status: 'success' });
            } else {
              results.push({ id: payout.id, status: 'error', error: paymentResult.error });
            }

          } catch (e: any) {
            results.push({ id: payout.id, status: 'error', error: e.message });
          }
        }

        return json(res, 200, { processed: results.length, details: results });
      } catch (err) {
        return serverError(res, err);
      }
    }

    // --- LIST WEBHOOKS (ADMIN ONLY) ---
    if (action === 'list-webhooks' || url.includes('list-webhooks')) {
      try {
        const token = req.headers.authorization?.split(' ')[1] || '';
        const { data: userData } = await supabase.auth.getUser(token);
        const user = userData?.user;
        if (!user) return unauthorized(res);

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (profile?.role !== 'admin' && profile?.role !== 'founder') return unauthorized(res);

        const webhooks = await listK2Webhooks();
        return json(res, 200, webhooks);
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
