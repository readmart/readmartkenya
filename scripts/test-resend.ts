import { Resend } from 'resend';
import dotenv from 'dotenv';


// Load environment variables from .env
dotenv.config();

/**
 * Script to test Resend email integration
 * Run with: npx tsx scripts/test-resend.ts
 */
async function testResend() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'ReadMart <notifications@readmartke.com>';
  const toEmail = process.argv[2];

  console.log('📧 ReadMart Email Connectivity Test');
  console.log('-----------------------------------');

  if (!apiKey) {
    console.error('❌ Error: RESEND_API_KEY is not set in your .env file.');
    process.exit(1);
  }

  if (!toEmail) {
    console.error('❌ Error: Please provide a recipient email address.');
    console.log('Usage: npx tsx scripts/test-resend.ts your-email@example.com');
    process.exit(1);
  }

  console.log(`📡 Initializing Resend with API Key: ${apiKey.substring(0, 7)}...`);
  console.log(`📤 Sending from: ${fromEmail}`);
  console.log(`📥 Sending to: ${toEmail}`);

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      subject: 'ReadMart System: Email Integration Test',
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px;">
          <h2 style="color: #6366f1;">ReadMart Connection Successful!</h2>
          <p>This is a test email to verify that your Resend API integration is working correctly.</p>
          <div style="background: #f9fafb; padding: 15px; border-radius: 8px; font-size: 14px;">
            <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Status:</strong> Active & Functional</p>
          </div>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">
            If you received this, your environment variables are correctly configured.
          </p>
        </div>
      `
    });

    if (error) {
      console.error('❌ Resend API Error:', error.name, '-', error.message);
      if (error.message.includes('not verified')) {
        console.log('\n💡 Tip: You need to verify your domain (readmartke.com) in the Resend dashboard');
        console.log('or use the email address associated with your Resend account if in testing mode.');
      }
      process.exit(1);
    }

    console.log('\n✅ Success! Email sent successfully.');
    console.log('Check your inbox (and spam folder) for the test message.');
    console.log('Resend ID:', data?.id);

  } catch (err: any) {
    console.error('❌ Unexpected Error:', err.message);
    process.exit(1);
  }
}

testResend();
