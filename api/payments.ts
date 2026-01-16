import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, badRequest, serverError, createNotification, calculateOrderCommissions } from './_utils.ts';
import {
  verifyK2Signature,
  extractK2WebhookData,
  initiateK2StkPush,
  getK2TransactionStatus,
  K2_EVENT_TYPES,
  getK2Token
} from './_payments.ts';
import { sendEmail, renderOrderConfirmationEmail } from './_email.ts';

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

    // --- WEBHOOK HANDLER ---
    if (url.includes('webhook')) {
      if (method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
      
      const signature = (req.headers['x-kopokopo-signature'] || req.headers['x-k2-signature']) as string;
      const payload = req.body;
      const queryOrderId = req.query.orderId as string;
      
      console.log('--- Webhook Received ---', JSON.stringify(payload));
      
      if (!verifyK2Signature(payload, signature)) {
        console.error('Invalid K2 signature');
        return json(res, 401, { error: 'Invalid signature' });
      }

      const webhookData = extractK2WebhookData(payload);
      const { transactionId, isSuccess, amount, phone, eventType, senderName } = webhookData;
      const orderId = webhookData.orderId || queryOrderId;
      
      if (orderId) {
        if ([K2_EVENT_TYPES.STK_PUSH_SUCCESS, K2_EVENT_TYPES.BUYGOODS_RECEIVED, K2_EVENT_TYPES.PAYBILL_RECEIVED].includes(eventType)) {
          const finalStatus = isSuccess ? 'paid' : 'failed';
          
          // Update order
          const { data: updatedOrders, error: orderError } = await supabase
            .from('orders')
            .update({ 
              status: finalStatus, 
              payment_id: transactionId,
              payment_metadata: payload 
            })
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
              status: isSuccess ? 'completed' : 'failed',
              provider_reference: transactionId,
              metadata: payload
            }]);

            if (isSuccess) {
              await calculateOrderCommissions(order.id);
              
              // Notifications
              if (order.user_id) {
                await createNotification({
                  userId: order.user_id,
                  type: 'order',
                  title: 'Payment Received!',
                  message: `Your payment of KES ${order.total_amount} for order #${order.id.slice(0, 8).toUpperCase()} was successful.`,
                  link: `/account?tab=orders`
                });
              }

              // Email
              try {
                const { data: items } = await supabase.from('order_items').select('*').eq('order_id', order.id);
                // We'd need the user's email here. Assuming it's in the order's shipping_address or we fetch from profile.
                const email = order.shipping_address?.email;
                if (email) {
                  const html = renderOrderConfirmationEmail({ order, items: items || [] });
                  await sendEmail({
                    to: email,
                    subject: `Order Confirmed - #${order.id.slice(0, 8).toUpperCase()}`,
                    html
                  });
                }
              } catch (e) {
                console.error('Email failed:', e);
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
      const { orderId, phone, amount, firstName, lastName, email } = req.body;
      
      if (!orderId || !phone || !amount) return badRequest(res, 'Missing payment details');

      try {
        const k2Result = await initiateK2StkPush({
          phone,
          amount,
          orderId,
          firstName,
          lastName,
          email,
        });

        // Update order with payment request location for polling
        await supabase.from('orders').update({ 
          payment_id: k2Result.location || (k2Result as any).id,
          payment_metadata: k2Result 
        }).eq('id', orderId);

        return json(res, 200, k2Result);
      } catch (err: any) {
        if (err.message.includes('credentials') || err.message.includes('configured')) {
          console.warn('Payment credentials missing, using demo response');
          return json(res, 200, { demo: true, message: 'Demo mode active' });
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
