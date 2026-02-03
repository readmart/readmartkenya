/**
 * Test script for Resend Email Webhook
 * 
 * This script simulates a webhook call from Resend to the /api/emails endpoint.
 * It tests the processing of delivery events and database updates.
 */

const testWebhook = async () => {
  const LOCAL_API_URL = 'http://localhost:3000/api/emails'; // Adjust based on your local dev server
  
  // 1. Create a dummy log entry in the database first (manually or via a separate script)
  // For this test, we'll assume a resend_id exists in the DB.
  const dummyResendId = 'test_resend_id_' + Date.now();
  
  console.log(`Testing with dummy Resend ID: ${dummyResendId}`);

  // 2. Simulate 'email.delivered' event
  const deliveredPayload = {
    type: 'email.delivered',
    created_at: new Date().toISOString(),
    data: {
      email_id: dummyResendId,
      from: 'no-reply@readmartke.com',
      to: ['test@example.com'],
      subject: 'Test Email'
    }
  };

  console.log('Sending simulated "email.delivered" webhook...');
  try {
    const response = await fetch(LOCAL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deliveredPayload)
    });
    
    const result = await response.json();
    console.log('Response:', response.status, result);
  } catch (err) {
    console.error('Fetch failed:', err.message);
    console.log('Note: Ensure your local server is running at', LOCAL_API_URL);
  }

  // 3. Simulate 'email.opened' event
  const openedPayload = {
    type: 'email.opened',
    created_at: new Date().toISOString(),
    data: {
      email_id: dummyResendId
    }
  };

  console.log('Sending simulated "email.opened" webhook...');
  try {
    const response = await fetch(LOCAL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(openedPayload)
    });
    
    const result = await response.json();
    console.log('Response:', response.status, result);
  } catch (err) {
    console.error('Fetch failed:', err.message);
  }
};

// Run the test
// testWebhook();
console.log('Test script created. To run it, uncomment the testWebhook() call and run with node.');
