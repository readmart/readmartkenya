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

  // 1. Log initiation
  const { data: logEntry, error: logError } = await supabase
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
    .select()
    .single();

  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: fromAddr,
      to: Array.isArray(to) ? to : [to],
      bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
      reply_to: replyTo,
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
        ${data.attachment_url ? `
          <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <strong>Attachment:</strong> <a href="${data.attachment_url}" target="_blank">View Attached File</a>
          </p>
        ` : ''}
      </div>
      <p style="margin-top: 20px;">
        <a href="https://readmartke.com/dashboard/founder" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View in Dashboard</a>
      </p>
    </div>
  `;
};

export const renderFailedPaymentEmail = (data: any) => {
  const { order } = data;
  const id = order.id.slice(0, 8).toUpperCase();
  const formatPrice = (amount: number) => `KES ${Number(amount).toLocaleString()}`;
  
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h1 style="color: #ef4444;">Payment Failed</h1>
      <p>Hello ${order.shipping_address?.full_name || 'Customer'},</p>
      <p>We were unable to process your payment of <strong>${formatPrice(order.total_amount)}</strong> for order #${id}.</p>
      <div style="background: #fef2f2; padding: 20px; border-radius: 8px; border: 1px solid #fee2e2; margin: 20px 0;">
        <p><strong>Reason:</strong> The M-Pesa transaction was cancelled or failed to complete.</p>
        <p>Don't worry, your items are still reserved for a limited time. You can try paying again by clicking the button below.</p>
      </div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="https://readmartke.com/checkout" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Retry Payment</a>
      </p>
      <p>If you need assistance, please reply to this email.</p>
      <p>Best regards,<br/>The ReadMart Team</p>
    </div>
  `;
};

export const renderAbandonedCartEmail = (data: any) => {
  const { user, cartTotal } = data;
  const formatPrice = (amount: number) => `KES ${Number(amount).toLocaleString()}`;

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h1 style="color: #6366f1;">Forgot something?</h1>
      <p>Hello ${user.full_name || 'there'},</p>
      <p>We noticed you left some items in your cart. They are waiting for you!</p>
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
        <p>Your cart total: <strong>${formatPrice(cartTotal)}</strong></p>
      </div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="https://readmartke.com/cart" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Return to Cart</a>
      </p>
      <p>Items in high demand may sell out, so grab them while you can!</p>
      <p>Best regards,<br/>The ReadMart Team</p>
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

export const renderAgreementNotificationEmail = (type: string, data: any) => {
  const protocolName = type === 'author' ? 'Author Protocol' : 'Partnership Agreement';
  const dashboardLink = 'https://readmartke.com/account?tab=agreements';
  
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #6366f1;">Action Required: ${protocolName} Ready for Review</h2>
      <p>Hello ${data.full_name},</p>
      <p>We are pleased to inform you that the agreement for your <strong>ReadMart ${type}</strong> application has been prepared and is now ready for your review and signature.</p>
      
      <div style="background: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
        <p><strong>Next Steps:</strong></p>
        <ol>
          <li>Login to your ReadMart account.</li>
          <li>Navigate to "My Account" > "Agreements".</li>
          <li>Download and review the attached document.</li>
          <li>Sign and upload the completed agreement to proceed with account activation.</li>
        </ol>
      </div>

      <p style="margin-top: 20px;">
        <a href="${dashboardLink}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Review Agreement</a>
      </p>
      
      <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">
        If you have any questions regarding the terms, please reply to this email or contact us via our official channels.
      </p>
      <p>Best regards,<br/>The ReadMart Team</p>
    </div>
  `;
};

export const renderActivationNotificationEmail = (type: string, data: any) => {
  const roleName = type === 'author' ? 'Author' : 'Partner';
  const dashboardLink = type === 'author' ? 'https://readmartke.com/dashboard/author' : 'https://readmartke.com/dashboard/partner';
  
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h1 style="color: #22c55e;">Account Activated!</h1>
      <p>Hello ${data.full_name},</p>
      <p>Congratulations! Your <strong>ReadMart ${roleName}</strong> account has been successfully activated.</p>
      
      <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; border: 1px solid #dcfce7; margin: 20px 0;">
        <p><strong>What's Next?</strong></p>
        <p>You now have full access to your specialized dashboard where you can:</p>
        <ul>
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

      <p style="text-align: center; margin: 30px 0;">
        <a href="${dashboardLink}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to My Dashboard</a>
      </p>
      
      <p><strong>Login Credentials:</strong> Use your registered email address and password to sign in.</p>
      
      <p style="font-size: 12px; color: #6b7280; margin-top: 30px;">
        Need help getting started? Check out our <a href="https://readmartke.com/help" style="color: #6366f1;">Guide for ${roleName}s</a>.
      </p>
      <p>Welcome to the ReadMart ecosystem!</p>
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
    const password = item.product?.metadata?.ebook_password || item.product_snapshot?.metadata?.ebook_password || item.ebook_password;
    
    return `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">
        <div style="font-weight: bold;">${item.product_snapshot?.title || 'Product'} x ${item.quantity}</div>
        ${isEbook ? `
          <div style="font-size: 12px; color: #6366f1; margin-top: 4px;">
            <strong>Digital E-book (PDF)</strong><br/>
            Access Password: <span style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-weight: bold; color: #333;">${password || 'N/A'}</span><br/>
            <a href="https://readmartke.com/account?tab=ebooks" style="color: #6366f1; text-decoration: underline; font-weight: bold; display: inline-block; mt-2;">Download from your Account</a>
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

export const renderNewsletterConfirmationEmail = (data: { email: string; token: string }) => {
  const confirmLink = `https://readmartke.com/api/newsletter?confirm=${data.token}`;
  
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #6366f1; margin-bottom: 10px;">Welcome to ReadMart!</h1>
        <p style="font-size: 16px; color: #666;">You're almost there. Please confirm your subscription to our newsletter.</p>
      </div>
      
      <div style="background: #f8fafc; padding: 30px; border-radius: 12px; border: 1px solid #e2e8f0; text-align: center;">
        <p style="margin-bottom: 25px;">Click the button below to confirm your subscription and start receiving our latest updates, book releases, and exclusive offers.</p>
        
        <a href="${confirmLink}" style="display: inline-block; background: #6366f1; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.4);">Confirm Subscription</a>
        
        <p style="margin-top: 25px; font-size: 13px; color: #94a3b8;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="font-size: 12px; word-break: break-all; color: #6366f1;">${confirmLink}</p>
      </div>
      
      <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #94a3b8; text-align: center;">
        <p>If you didn't request this, you can safely ignore this email.</p>
        <p>&copy; ${new Date().getFullYear()} ReadMart KE. All rights reserved.</p>
      </div>
    </div>
  `;
};
