
import dotenv from 'dotenv';
import { initiateK2StkPush } from '../api/_payments.js';

dotenv.config();

async function triggerLiveStkPush() {
  console.log('🚀 Initiating Live STK Push for 0714921381...');
  
  const testParams = {
    amount: 1, // Minimum amount for testing
    phone: '0714921381',
    firstName: 'ReadMart',
    lastName: 'Test',
    email: 'test@readmartke.com',
    orderId: 'LIVE_TEST_' + Date.now(),
    notes: 'Live STK Push Verification',
    currency: 'KES'
  };

  try {
    const result = await initiateK2StkPush(testParams);
    
    if (result.success) {
      console.log('✅ STK Push Request Successful!');
      console.log('📍 Location URL:', result.location);
      console.log('📱 Please check phone 0714921381 for the M-Pesa prompt.');
    } else {
      console.error('❌ STK Push Request Failed!');
      console.error('Status:', result.status);
      console.error('Error:', result.error);
    }
  } catch (error) {
    console.error('💥 Unexpected Error during STK Push:', error);
  }
}

triggerLiveStkPush();
