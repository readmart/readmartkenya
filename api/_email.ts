import { Resend } from 'resend';
import { supabase } from './_db.js';

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
  bcc?: string | string[];
  replyTo?: string;
}

export const sendEmail = async (params: SendEmailParams) => {
  const { to, subject, html, body, bcc, replyTo } = params;
  const fromAddr = params.from || process.env.EMAIL_FROM || 'ReadMart <no-reply@readmartke.com>';
  const recipient = Array.isArray(to) ? to.join(', ') : to;

  // 1. Log initiation with hardened selection for schema cache
  let logEntry: any = null;
  try {
    const { data, error } = await supabase
      .from('notification_logs')
      .insert([{ 
        recipient, 
        subject, 
        status: 'pending',
        metadata: { 
          from: fromAddr,
          bcc: bcc ? (Array.isArray(bcc) ? bcc.join(', ') : bcc) : undefined,
          replyTo
        }
      }])
      .select('id')
      .maybeSingle();
    
    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('cache')) {
        console.warn('notification_logs schema cache issue, continuing without logging');
      } else {
        console.error('Failed to log notification:', error);
      }
    } else {
      logEntry = data;
    }
  } catch (e) {
    console.warn('Notification logging failed, proceeding with email send:', e);
  }

  try {
    const resend = getResend();
    
    // Retry logic for Resend API
    let attempt = 0;
    const maxAttempts = 3;
    let lastError = null;
    let data = null;

    while (attempt < maxAttempts) {
      try {
        const result = await resend.emails.send({
          from: fromAddr,
          to: Array.isArray(to) ? to : [to],
          bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
          reply_to: replyTo,
          subject,
          html: html || `<pre>${body}</pre>`,
        });
        
        if (result.error) {
          lastError = result.error;
          // If it's a rate limit or server error, we might want to retry
          if (result.error.name === 'rate_limit_exceeded' || result.error.name === 'internal_server_error') {
            attempt++;
            if (attempt < maxAttempts) {
              const delay = Math.pow(2, attempt) * 1000;
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
          }
          // Otherwise, break and handle the error
          data = result.data;
          break;
        }
        
        data = result.data;
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        attempt++;
        if (attempt < maxAttempts) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (lastError) {
      const errorMsg = (lastError as any).message || String(lastError);
      console.error(`Resend error after ${attempt} attempts:`, lastError);
      // Update log with failure
      if (logEntry?.id) {
        try {
          await supabase
            .from('notification_logs')
            .update({ status: 'failed', error_message: errorMsg })
            .eq('id', logEntry.id);
        } catch (e) {
          console.warn('Failed to update failure status in notification_logs');
        }
      }
      return { success: false, error: errorMsg };
    }

    // Update log with success
    if (logEntry?.id) {
      try {
        await supabase
          .from('notification_logs')
          .update({ 
            status: 'sent', 
            resend_id: data?.id,
            metadata: { ...logEntry.metadata, resend_data: data } 
          })
          .eq('id', logEntry.id);
      } catch (e) {
        console.warn('Failed to update success status in notification_logs');
      }
    }

    return { success: true, data };
  } catch (err) {
    console.error('Failed to send email:', err);
    // Update log with exception
    if (logEntry?.id) {
      try {
        await supabase
          .from('notification_logs')
          .update({ status: 'failed', error_message: String(err) })
          .eq('id', logEntry.id);
      } catch (e) {
        console.warn('Failed to update error status in notification_logs');
      }
    }
    return { success: false, error: String(err) };
  }
};

export const wrapEmailTemplate = (content: string, previewText: string = '') => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ReadMart</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f9fafb; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; margin-top: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); }
          .header { background-color: #6366f1; padding: 32px 24px; text-align: center; }
          .header img { height: 40px; margin-bottom: 12px; }
          .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; }
          .content { padding: 40px 32px; }
          .footer { background-color: #f3f4f6; padding: 24px; text-align: center; font-size: 14px; color: #6b7280; }
          .footer a { color: #6366f1; text-decoration: none; }
          .button { display: inline-block; background-color: #6366f1; color: #ffffff !important; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 24px; }
          .preview-text { display: none; max-height: 0px; overflow: hidden; }
        </style>
      </head>
      <body>
        ${previewText ? `<div class="preview-text">${previewText}</div>` : ''}
        <div class="container">
          <div class="header">
            <img src="https://readmartke.com/logo-white.png" alt="ReadMart Logo">
            <h1>ReadMart</h1>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ReadMart Kenya. All rights reserved.</p>
            <p>
              <a href="https://readmartke.com">Website</a> &bull; 
              <a href="https://readmartke.com/dashboard">My Account</a> &bull; 
              <a href="https://readmartke.com/help">Help Center</a>
            </p>
            <p style="margin-top: 16px; font-size: 12px;">
              You received this email because you are a registered user of ReadMart.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
};

export const renderContactNotificationEmail = (data: any) => {
  const html = `
      <h2 style="color: #6366f1; margin-top: 0;">New Inquiry Received</h2>
      <p>A new message has been submitted via the contact form:</p>
      <div style="background: #f9fafb; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="margin-top: 0;"><strong>From:</strong> ${data.full_name} (${data.email})</p>
        <p><strong>Subject:</strong> ${data.subject}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap; color: #4b5563;">${data.message}</p>
        ${data.attachment_url ? `
          <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <strong>Attachment:</strong> <a href="${data.attachment_url}" target="_blank" style="color: #6366f1;">View Attached File</a>
          </p>
        ` : ''}
      </div>
      <p style="text-align: center;">
        <a href="https://readmartke.com/dashboard/founder" class="button">View in Dashboard</a>
      </p>
  `;
  return wrapEmailTemplate(html, `New message from ${data.full_name}: ${data.subject}`);
};

export const renderFailedPaymentEmail = (data: any) => {
  const { order } = data;
  const id = order.id.slice(0, 8).toUpperCase();
  const formatPrice = (amount: number) => `KES ${Number(amount).toLocaleString()}`;
  
  const html = `
      <h2 style="color: #ef4444; margin-top: 0;">Payment Failed</h2>
      <p>Hello ${order.shipping_address?.full_name || 'Customer'},</p>
      <p>We were unable to process your payment of <strong>${formatPrice(order.total_amount)}</strong> for order #${id}.</p>
      <div style="background: #fef2f2; padding: 24px; border-radius: 8px; border: 1px solid #fee2e2; margin: 24px 0;">
        <p style="margin-top: 0;"><strong>Reason:</strong> The M-Pesa transaction was cancelled or failed to complete.</p>
        <p style="margin-bottom: 0;">Don't worry, your items are still reserved for a limited time. You can try paying again by clicking the button below.</p>
      </div>
      <p style="text-align: center;">
        <a href="https://readmartke.com/checkout" class="button" style="background-color: #ef4444;">Retry Payment</a>
      </p>
      <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">If you need assistance, please reply to this email or contact our support team.</p>
  `;
  return wrapEmailTemplate(html, `Action Required: Payment failed for order #${id}`);
};

export const renderAbandonedCartEmail = (data: any) => {
  const { user, cartTotal } = data;
  const formatPrice = (amount: number) => `KES ${Number(amount).toLocaleString()}`;

  const html = `
      <h2 style="color: #6366f1; margin-top: 0;">Forgot something?</h2>
      <p>Hello ${user.full_name || 'there'},</p>
      <p>We noticed you left some items in your cart. They are waiting for you!</p>
      <div style="background: #f3f4f6; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="margin: 0;">Your cart total: <strong style="color: #6366f1; font-size: 18px;">${formatPrice(cartTotal)}</strong></p>
      </div>
      <p style="text-align: center;">
        <a href="https://readmartke.com/cart" class="button">Return to Cart</a>
      </p>
      <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">Items in high demand may sell out, so grab them while you can!</p>
  `;
  return wrapEmailTemplate(html, "Your ReadMart cart is waiting for you!");
};

export const renderApplicationNotificationEmail = (type: 'author' | 'partner', data: any) => {
  const title = type === 'author' ? 'New Author Application' : 'New Partnership Application';
  const html = `
      <h2 style="color: #6366f1; margin-top: 0;">${title}</h2>
      <p>A new application has been submitted for review:</p>
      <div style="background: #f9fafb; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="margin-top: 0;"><strong>Name:</strong> ${data.full_name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Organization:</strong> ${data.organization || 'N/A'}</p>
        <p><strong>Service/Role:</strong> ${data.service_type || data.role || 'N/A'}</p>
        <p><strong>Bio/Description:</strong></p>
        <p style="white-space: pre-wrap; color: #4b5563;">${data.bio || data.description}</p>
      </div>
      <p style="text-align: center;">
        <a href="https://readmartke.com/dashboard/founder" class="button">Review Application</a>
      </p>
  `;
  return wrapEmailTemplate(html, `${title}: ${data.full_name}`);
};

export const renderApplicationStatusEmail = (status: 'approved' | 'rejected', type: string, data: any) => {
  const isApproved = status === 'approved';
  const color = isApproved ? '#22c55e' : '#ef4444';
  const subject = isApproved ? 'Application Approved!' : 'Application Update';
  
  const html = `
      <h2 style="color: ${color}; margin-top: 0;">${subject}</h2>
      <p>Hello ${data.full_name},</p>
      <p>Regarding your application for the <strong>ReadMart ${type}</strong> program:</p>
      <div style="background: #f9fafb; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="margin-top: 0;">Status: <strong style="color: ${color}; text-transform: uppercase;">${status}</strong></p>
        ${isApproved 
          ? `<p style="margin-bottom: 0;">Welcome to the community! You can now access your dashboard to complete your profile and start your journey with us.</p>`
          : `<p style="margin-bottom: 0;">Thank you for your interest. Unfortunately, we cannot proceed with your application at this time. We appreciate your passion for the literary arts.</p>`
        }
      </div>
      ${isApproved ? `
      <p style="text-align: center;">
        <a href="https://readmartke.com/login" class="button" style="background-color: ${color};">Go to Dashboard</a>
      </p>
      ` : ''}
  `;
  return wrapEmailTemplate(html, `Update on your ReadMart ${type} application`);
};

export const renderAgreementNotificationEmail = (type: string, data: any) => {
  const protocolName = type === 'author' ? 'Author Protocol' : 'Partnership Agreement';
  const dashboardLink = 'https://readmartke.com/account?tab=agreements';
  
  const html = `
      <h2 style="color: #6366f1; margin-top: 0;">Action Required: ${protocolName} Ready</h2>
      <p>Hello ${data.full_name},</p>
      <p>We are pleased to inform you that the agreement for your <strong>ReadMart ${type}</strong> application has been prepared and is now ready for your review and signature.</p>
      
      <div style="background: #f9fafb; padding: 24px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="margin-top: 0;"><strong>Next Steps:</strong></p>
        <ol style="color: #4b5563; padding-left: 20px;">
          <li>Login to your ReadMart account.</li>
          <li>Navigate to "My Account" > "Agreements".</li>
          <li>Download and review the attached document.</li>
          <li>Sign and upload the completed agreement to proceed.</li>
        </ol>
      </div>

      <p style="text-align: center;">
        <a href="${dashboardLink}" class="button">Review & Sign Agreement</a>
      </p>
      
      <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">
        If you have any questions regarding the terms, please reply to this email.
      </p>
  `;
  return wrapEmailTemplate(html, `Action Required: Your ${protocolName} is ready for review`);
};

export const renderActivationNotificationEmail = (type: string, data: any) => {
  const roleName = type === 'author' ? 'Author' : 'Partner';
  const dashboardLink = type === 'author' ? 'https://readmartke.com/dashboard/author' : 'https://readmartke.com/dashboard/partner';
  
  const html = `
      <h2 style="color: #22c55e; margin-top: 0;">Account Activated!</h2>
      <p>Hello ${data.full_name},</p>
      <p>Congratulations! Your <strong>ReadMart ${roleName}</strong> account has been successfully activated.</p>
      
      <div style="background: #f0fdf4; padding: 24px; border-radius: 8px; border: 1px solid #dcfce7; margin: 24px 0;">
        <p style="margin-top: 0; font-weight: 600;">What's Next?</p>
        <p>You now have full access to your specialized dashboard where you can:</p>
        <ul style="color: #166534; padding-left: 20px;">
          ${type === 'author' 
            ? `
            <li>Submit new manuscripts and manage publications</li>
            <li>Track sales and royalties in real-time</li>
            <li>Engage with your readers and view feedback</li>
            `
            : `
            <li>Manage partnership projects and inventory</li>
            <li>Analyze revenue and performance metrics</li>
            <li>Access our partner resource library</li>
            `
          }
        </ul>
      </div>

      <p style="text-align: center;">
        <a href="${dashboardLink}" class="button" style="background-color: #22c55e;">Go to My Dashboard</a>
      </p>
      
      <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">
        Need help getting started? Check out our <a href="https://readmartke.com/help" style="color: #6366f1;">Guide for ${roleName}s</a>.
      </p>
  `;
  return wrapEmailTemplate(html, `Welcome aboard! Your ReadMart ${roleName} account is active`);
};

export const renderOrderConfirmationEmail = (data: any) => {
  const { order, items } = data;
  const id = order.id.slice(0, 8).toUpperCase();
  const formatPrice = (amount: number) => `KES ${Number(amount).toLocaleString()}`;
  
  const itemsHtml = items.map((item: any) => {
    const isEbook = item.product_snapshot?.type === 'ebook' || item.is_ebook;
    const password = item.product?.metadata?.ebook_password || item.product_snapshot?.metadata?.ebook_password || item.ebook_password;
    
    return `
    <tr>
      <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb;">
        <div style="font-weight: 600; color: #111827;">${item.product_snapshot?.title || 'Product'}</div>
        <div style="font-size: 14px; color: #6b7280;">Qty: ${item.quantity} &bull; ${formatPrice(item.price_at_purchase)} each</div>
        ${isEbook ? `
          <div style="font-size: 13px; color: #4f46e5; margin-top: 8px; background: #eef2ff; padding: 12px; border-radius: 6px;">
            <strong>Digital E-book Access</strong><br/>
            Password: <code style="background: #ffffff; padding: 2px 6px; border-radius: 4px; font-weight: bold; border: 1px solid #e0e7ff;">${password || 'N/A'}</code><br/>
            <a href="https://readmartke.com/account?tab=ebooks" style="color: #4f46e5; text-decoration: underline; font-weight: 600; display: inline-block; margin-top: 4px;">Download from your library</a>
          </div>
        ` : ''}
      </td>
      <td style="padding: 16px 0; border-bottom: 1px solid #e5e7eb; text-align: right; vertical-align: top; font-weight: 600; color: #111827;">
        ${formatPrice(item.price_at_purchase * item.quantity)}
      </td>
    </tr>
  `;
  }).join('');

  const html = `
      <h2 style="color: #111827; margin-top: 0;">Order Confirmed!</h2>
      <p>Thank you for your purchase. Your order <strong>#${id}</strong> has been received and is being processed.</p>
      
      <div style="margin: 32px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; padding-bottom: 8px; border-bottom: 2px solid #f3f4f6;">Item</th>
              <th style="text-align: right; font-size: 12px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; padding-bottom: 8px; border-bottom: 2px solid #f3f4f6;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td style="padding-top: 16px; text-align: right; color: #6b7280;">Subtotal</td>
              <td style="padding-top: 16px; text-align: right; font-weight: 600;">${formatPrice(order.total_amount)}</td>
            </tr>
            <tr>
              <td style="padding-top: 8px; text-align: right; font-size: 18px; font-weight: 700; color: #111827;">Total Paid</td>
              <td style="padding-top: 8px; text-align: right; font-size: 18px; font-weight: 700; color: #6366f1;">${formatPrice(order.total_amount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style="background: #f9fafb; padding: 24px; border-radius: 8px; margin-top: 32px;">
        <h3 style="font-size: 16px; margin-top: 0; color: #111827;">Shipping Details</h3>
        <p style="font-size: 14px; color: #4b5563; margin-bottom: 0;">
          ${order.shipping_address?.full_name}<br/>
          ${order.shipping_address?.phone}<br/>
          ${order.shipping_address?.address || ''}<br/>
          ${order.shipping_address?.city || ''}, Kenya
        </p>
      </div>

      <p style="text-align: center; margin-top: 32px;">
        <a href="https://readmartke.com/account?tab=orders" class="button">Track Your Order</a>
      </p>
  `;
  return wrapEmailTemplate(html, `Your ReadMart order #${id} has been confirmed!`);
};

export const renderNewsletterConfirmationEmail = (data: { email: string; token: string }) => {
  const confirmLink = `https://readmartke.com/api/newsletter?confirm=${data.token}`;
  
  const html = `
      <h2 style="color: #6366f1; margin-top: 0;">Confirm Your Subscription</h2>
      <p>You're almost there! Please confirm your subscription to the ReadMart newsletter to stay updated with the latest book releases and exclusive offers.</p>
      
      <div style="background: #f8fafc; padding: 32px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center; margin: 24px 0;">
        <p style="margin-top: 0; margin-bottom: 24px;">Click the button below to confirm your email address.</p>
        <a href="${confirmLink}" class="button">Confirm Subscription</a>
        <p style="margin-top: 24px; font-size: 13px; color: #94a3b8;">If the button doesn't work, copy and paste this link:<br/>${confirmLink}</p>
      </div>
      
      <p style="font-size: 14px; color: #6b7280;">If you didn't request this, you can safely ignore this email.</p>
  `;
  return wrapEmailTemplate(html, "Action Required: Confirm your ReadMart subscription");
};
