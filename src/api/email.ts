import { Resend } from 'resend';

// Initialize Resend with the API key from environment variables
// Note: In Vite, we use import.meta.env for client-side and process.env for Node environments
const RESEND_API_KEY = import.meta.env?.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY;
const EMAIL_FROM = import.meta.env?.VITE_EMAIL_FROM || process.env.EMAIL_FROM || 'ReadMart <no-reply@readmartke.com>';

export const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  reply_to?: string;
  attachments?: any[];
}

/**
 * Core utility to send emails via Resend
 */
export async function sendEmail(options: EmailOptions) {
  if (!resend) {
    console.error('[Email] Resend API key is missing. Cannot send email.');
    return { success: false, error: 'API key missing' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      cc: options.cc,
      bcc: options.bcc,
      reply_to: options.reply_to,
      attachments: options.attachments,
    });

    if (error) {
      console.error('[Email] Resend error:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('[Email] Unexpected error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Standardized Email Templates
 */
export const EmailTemplates = {
  welcome: (name: string) => ({
    subject: 'Welcome to ReadMart!',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #000;">Welcome to ReadMart, ${name}!</h2>
        <p>We're thrilled to have you join our community of readers and creators.</p>
        <p>Explore our latest collection of books, events, and exclusive author content.</p>
        <div style="margin-top: 30px;">
          <a href="https://www.readmartke.com/shop" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Start Reading</a>
        </div>
        <p style="margin-top: 30px; font-size: 12px; color: #666;">If you have any questions, just reply to this email.</p>
      </div>
    `
  }),

  orderConfirmation: (orderId: string, total: string) => ({
    subject: `Order Confirmation #${orderId}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #000;">Thank you for your order!</h2>
        <p>Your order <strong>#${orderId}</strong> has been confirmed and is being processed.</p>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 0;"><strong>Total Amount:</strong> ${total}</p>
        </div>
        <p>You can track your order status in your dashboard.</p>
        <div style="margin-top: 30px;">
          <a href="https://www.readmartke.com/dashboard/orders" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">View Order</a>
        </div>
      </div>
    `
  }),

  partnerApproval: (companyName: string) => ({
    subject: 'Partnership Application Approved!',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #000;">Congratulations, ${companyName}!</h2>
        <p>Your partnership application with ReadMart has been <strong>approved</strong>.</p>
        <p>You now have access to our partner ecosystem and global collaboration tools.</p>
        <p>Please log in to your dashboard to complete your profile and explore your benefits.</p>
        <div style="margin-top: 30px;">
          <a href="https://www.readmartke.com/dashboard/partnership" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Access Dashboard</a>
        </div>
      </div>
    `
  })
};
