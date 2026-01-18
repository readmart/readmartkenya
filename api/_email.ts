import { Resend } from 'resend';
import { supabase } from './_db.ts';

let resendInstance: Resend | null = null;

const getResend = () => {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('RESEND_API_KEY not set. Email functionality will be limited.');
      return {
        emails: {
          send: async () => ({ data: null, error: new Error('RESEND_API_KEY not set') })
        }
      } as unknown as Resend;
    }
    resendInstance = new Resend(apiKey);
  }
  return resendInstance;
};

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html?: string;
  body?: string;
  from?: string;
}

export const sendEmail = async (params: SendEmailParams) => {
  const { to, subject, html, body } = params;
  const fromAddr = params.from || process.env.EMAIL_FROM || 'ReadMart <notifications@readmartke.com>';
  const recipient = Array.isArray(to) ? to.join(', ') : to;

  // 1. Log initiation
  const { data: logEntry, error: logError } = await supabase
    .from('notification_logs')
    .insert([{ 
      recipient, 
      subject, 
      status: 'pending',
      metadata: { from: fromAddr }
    }])
    .select()
    .single();

  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: fromAddr,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || `<pre>${body}</pre>`,
    });

    if (error) {
      console.error('Resend error:', error);
      // Update log with failure
      if (logEntry) {
        await supabase
          .from('notification_logs')
          .update({ status: 'failed', error_message: error.message })
          .eq('id', logEntry.id);
      }
      return { success: false, error: error.message };
    }

    // Update log with success
    if (logEntry) {
      await supabase
        .from('notification_logs')
        .update({ status: 'sent', metadata: { ...logEntry.metadata, resend_id: data?.id } })
        .eq('id', logEntry.id);
    }

    return { success: true, data };
  } catch (err) {
    console.error('Failed to send email:', err);
    // Update log with exception
    if (logEntry) {
      await supabase
        .from('notification_logs')
        .update({ status: 'failed', error_message: String(err) })
        .eq('id', logEntry.id);
    }
    return { success: false, error: String(err) };
  }
};

export const renderContactNotificationEmail = (data: any) => {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #6366f1;">New Inquiry Received</h2>
      <p>A new message has been submitted via the contact form:</p>
      <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
        <p><strong>From:</strong> ${data.full_name} (${data.email})</p>
        <p><strong>Subject:</strong> ${data.subject}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${data.message}</p>
      </div>
      <p style="margin-top: 20px;">
        <a href="https://readmartke.com/dashboard/founder" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View in Dashboard</a>
      </p>
    </div>
  `;
};

export const renderApplicationNotificationEmail = (type: 'author' | 'partner', data: any) => {
  const title = type === 'author' ? 'New Author Application' : 'New Partnership Application';
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #6366f1;">${title}</h2>
      <p>A new application has been submitted:</p>
      <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
        <p><strong>Name:</strong> ${data.full_name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Organization:</strong> ${data.organization || 'N/A'}</p>
        <p><strong>Service/Role:</strong> ${data.service_type || data.role || 'N/A'}</p>
        <p><strong>Bio/Description:</strong></p>
        <p style="white-space: pre-wrap;">${data.bio || data.description}</p>
      </div>
      <p style="margin-top: 20px;">
        <a href="https://readmartke.com/dashboard/founder" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Review Application</a>
      </p>
    </div>
  `;
};

export const renderApplicationStatusEmail = (status: 'approved' | 'rejected', type: string, data: any) => {
  const isApproved = status === 'approved';
  const color = isApproved ? '#22c55e' : '#ef4444';
  const subject = isApproved ? 'Application Approved!' : 'Application Update';
  
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: ${color};">${subject}</h2>
      <p>Hello ${data.full_name},</p>
      <p>Regarding your application for the <strong>ReadMart ${type}</strong> program:</p>
      <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
        <p>Status: <strong style="color: ${color}; text-transform: uppercase;">${status}</strong></p>
        ${isApproved 
          ? `<p>Welcome to the community! You can now access your dashboard to complete your profile and start your journey with us.</p>`
          : `<p>Thank you for your interest. Unfortunately, we cannot proceed with your application at this time. We appreciate your passion for the literary arts.</p>`
        }
      </div>
      ${isApproved ? `
      <p>
        <a href="https://readmartke.com/login" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Dashboard</a>
      </p>
      ` : ''}
      <p>Best regards,<br/>The ReadMart Team</p>
    </div>
  `;
};

export const renderOrderConfirmationEmail = (data: any) => {
  const { order, items } = data;
  const id = order.id.slice(0, 8).toUpperCase();
  const formatPrice = (amount: number) => `KES ${Number(amount).toLocaleString()}`;
  
  const itemsHtml = items.map((item: any) => {
    const isEbook = item.product_snapshot?.type === 'ebook' || item.is_ebook;
    const password = item.ebook_password || (item.ebook_metadata?.password);
    
    return `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        <div style="font-weight: bold;">${item.product_snapshot?.title || 'Product'} x ${item.quantity}</div>
        ${isEbook ? `
          <div style="font-size: 12px; color: #6366f1; margin-top: 4px;">
            <strong>Digital E-book (PDF)</strong><br/>
            Access Password: <span style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-weight: bold; color: #333;">${password || 'N/A'}</span>
          </div>
        ` : ''}
      </td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; vertical-align: top;">
        ${formatPrice(item.price_at_purchase * item.quantity)}
      </td>
    </tr>
  `;
  }).join('');

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h1 style="color: #6366f1;">Order Confirmed!</h1>
      <p>Thank you for your purchase at ReadMart. Your order #${id} has been received.</p>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="padding: 10px; text-align: left;">Item</th>
            <th style="padding: 10px; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td style="padding: 10px; font-weight: bold; text-align: right;">Total</td>
            <td style="padding: 10px; text-align: right; font-weight: bold; color: #6366f1;">
              ${formatPrice(order.total_amount)}
            </td>
          </tr>
        </tfoot>
      </table>
      <p style="margin-top: 20px; font-size: 12px; color: #999;">
        &copy; ${new Date().getFullYear()} ReadMart KE. All rights reserved.
      </p>
    </div>
  `;
};
