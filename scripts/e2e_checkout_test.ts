import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
// @ts-ignore
import handler from '../api/payments.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const TEST_PHONE = '0714921381';
const TEST_USER_ID = '40d57d9d-06c5-496a-b074-95ab21815dcf';
const CLIENT_SECRET = process.env.KOPOKOPO_API_KEY || 'test_secret';

async function runE2ETest() {
  console.log('🚀 Starting End-to-End Checkout Test (Direct Handler Call)...');

  try {
    // 1. Create a Test Order
    console.log('\n--- 1. Creating Test Order ---');
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        user_id: TEST_USER_ID,
        subtotal_amount: 100,
        shipping_amount: 50,
        total_amount: 150,
        status: 'pending',
        payment_method: 'm-pesa',
        shipping_address: {
          full_name: 'Test User',
          email: 'test@example.com',
          phone: TEST_PHONE,
          address: '123 Test St',
          city: 'Nairobi'
        }
      }])
      .select()
      .single();

    if (orderError) throw orderError;
    console.log(`✅ Order created: ${order.id}`);

    // 2. Simulate Success Webhook
    console.log('\n--- 2. Simulating Successful Payment Webhook ---');
    const successPayload = createWebhookPayload(order.id, 'Received', TEST_PHONE);
    await callHandlerDirectly(successPayload);

    // 3. Verify Order Status (Success)
    console.log('\n--- 3. Verifying Order Status (Paid) ---');
    // Wait a bit for processing
    await new Promise(r => setTimeout(r, 2000));
    
    const { data: updatedOrderSuccess, error: verifyErrorSuccess } = await supabase
      .from('orders')
      .select('status')
      .eq('id', order.id)
      .single();

    if (verifyErrorSuccess) throw verifyErrorSuccess;
    console.log(`Order status: ${updatedOrderSuccess.status}`);
    
    if (updatedOrderSuccess.status === 'paid' || updatedOrderSuccess.status === 'processing') {
      console.log('✅ Success scenario verified!');
    } else {
      console.error('❌ Success scenario FAILED: Order status not updated correctly');
    }

    // 4. Create another Order for Failure Test
    console.log('\n--- 4. Creating Test Order for Failure Scenario ---');
    const { data: orderFail, error: orderFailError } = await supabase
      .from('orders')
      .insert([{
        user_id: TEST_USER_ID,
        total_amount: 200,
        status: 'pending',
        payment_method: 'm-pesa',
        shipping_address: { phone: TEST_PHONE }
      }])
      .select()
      .single();

    if (orderFailError) throw orderFailError;
    console.log(`✅ Order created: ${orderFail.id}`);

    // 5. Simulate Failed Webhook
    console.log('\n--- 5. Simulating Failed Payment Webhook ---');
    const failPayload = createWebhookPayload(orderFail.id, 'Failed', TEST_PHONE);
    await callHandlerDirectly(failPayload);

    // 6. Verify Order Status (Cancelled)
    console.log('\n--- 6. Verifying Order Status (Cancelled) ---');
    await new Promise(r => setTimeout(r, 2000));

    const { data: updatedOrderFail, error: verifyErrorFail } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderFail.id)
      .single();

    if (verifyErrorFail) throw verifyErrorFail;
    console.log(`Order status: ${updatedOrderFail.status}`);
    
    if (updatedOrderFail.status === 'cancelled') {
      console.log('✅ Failure scenario verified (Status updated to cancelled)!');
    } else {
      console.log('❌ Failure scenario FAILED: Order status not updated to cancelled');
    }

  } catch (error: any) {
    console.error('\n❌ Test execution failed:', error.message);
  } finally {
    console.log('\n🏁 E2E Test Completed.');
  }
}

function createWebhookPayload(orderId: string, status: string, phone: string) {
  return {
    "topic": "buygoods_transaction_received",
    "id": "test-evt-" + Math.random().toString(36).substring(7),
    "created_at": new Date().toISOString(),
    "event": {
      "type": "Buygoods Transaction",
      "resource": {
        "id": "test-res-" + Math.random().toString(36).substring(7),
        "amount": "150.0",
        "status": status,
        "system": "Lipa Na M-PESA",
        "currency": "KES",
        "reference": "REF" + Math.random().toString(36).substring(7).toUpperCase(),
        "till_number": "4622964",
        "sender_phone_number": phone.startsWith('+') ? phone : `+254${phone.replace(/^0/, '')}`,
        "sender_last_name": "User",
        "sender_first_name": "Test"
      }
    },
    "metadata": {
      "order_id": orderId
    }
  };
}

async function callHandlerDirectly(payload: any) {
  const bodyString = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', CLIENT_SECRET).update(bodyString).digest('hex');

  const req: any = {
    method: 'POST',
    url: '/api/payments?action=webhook',
    query: { action: 'webhook' },
    headers: {
      'content-type': 'application/json',
      'x-kopokopo-signature': signature
    },
    body: payload
  };

  const res: any = {
    status: (code: number) => {
      console.log(`Status set to: ${code}`);
      return res;
    },
    json: (data: any) => {
      console.log('Response JSON:', JSON.stringify(data));
      return res;
    },
    setHeader: () => res,
    end: () => res
  };

  console.log(`Calling handler directly for order ${payload.metadata.order_id}...`);
  await handler(req, res);
}

runE2ETest();
