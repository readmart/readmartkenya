import 'dotenv/config';
import fetch from 'node-fetch';
import crypto from 'crypto';

/**
 * Test script to simulate a Kopo Kopo webhook hit with the sample payload provided.
 * 
 * Usage: 
 * 1. Ensure your local server is running (npm run dev)
 * 2. Run: npx tsx scripts/test_k2_webhook.ts
 */

const LOCAL_URL = 'http://localhost:3000/api/payments?action=webhook';
const CLIENT_SECRET = process.env.KOPOKOPO_CLIENT_SECRET || process.env.KOPOKOPO_API_KEY || 'test_secret';

const samplePayload = { 
  "topic": "buygoods_transaction_received", 
  "id": "test-webhook-event-" + Math.random().toString(36).substring(7), 
  "created_at": new Date().toISOString(), 
  "event": { 
    "type": "Buygoods Transaction", 
    "resource": { 
      "id": "test-resource-" + Math.random().toString(36).substring(7), 
      "amount": "100.0", 
      "status": "Received", 
      "system": "Lipa Na M-PESA", 
      "currency": "KES", 
      "reference": "REF" + Math.random().toString(36).substring(7).toUpperCase(), 
      "till_number": "000000", 
      "sender_phone_number": "+254999999999", 
      "hashed_sender_phone": "8f7bd03d28bb39ffbe7e074ad6a85352b4de2c8a8af1db7db7e5a520e37e015d", 
      "origination_time": new Date().toISOString(), 
      "sender_last_name": "Doe", 
      "sender_first_name": "Jane", 
      "sender_middle_name": null 
    } 
  },
  "metadata": {
    "order_id": "TEST-ORDER-ID" // This would normally be passed during initiation
  }
};

async function testWebhook() {
  console.log('--- Simulating K2 Webhook ---');
  console.log('Payload:', JSON.stringify(samplePayload, null, 2));

  const bodyString = JSON.stringify(samplePayload);
  const signature = crypto.createHmac('sha256', CLIENT_SECRET).update(bodyString).digest('hex');

  try {
    const response = await fetch(LOCAL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-kopokopo-signature': signature
      },
      body: bodyString
    });

    const status = response.status;
    const text = await response.text();

    console.log('--- Response ---');
    console.log('Status:', status);
    console.log('Body:', text);

    if (status === 200) {
      console.log('✅ Webhook test sent successfully!');
    } else {
      console.log('❌ Webhook test failed.');
    }
  } catch (err: any) {
    console.error('Error sending webhook:', err.message);
  }
}

testWebhook();
