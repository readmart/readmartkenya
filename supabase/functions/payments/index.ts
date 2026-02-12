


// @ts-nocheck
import { serve } from "jsr:@std/http/server@1.0.24"
import { createClient } from "jsr:@supabase/supabase-js@2"

interface K2WebhookData {
  webhookEventId: string;
  transactionId: string;
  eventType: string;
  status: string;
  amount: number;
  currency: string;
  phone: string;
  senderName: string;
  orderId: string;
  isSuccess: boolean;
}

interface ShippingAddress {
  full_name?: string;
  phone?: string;
  address?: string;
  city?: string;
}

interface ProductSnapshot {
  title?: string;
  type?: string;
  metadata?: {
    ebook_password?: string;
  };
  author_id?: string;
}

interface OrderItem {
  product?: {
    type?: string;
    metadata?: {
      ebook_password?: string;
    };
  };
  product_snapshot?: ProductSnapshot;
  is_ebook?: boolean;
  ebook_password?: string;
  quantity: number;
  price_at_purchase: number;
}

interface Order {
  id: string;
  total_amount: number;
  shipping_address?: ShippingAddress;
}

interface OrderConfirmationData {
  order: Order;
  items: OrderItem[];
}

interface FailedPaymentData {
  order: Order;
}

interface OrderItemCommission {
  id: string;
  product_id: string;
  quantity: number;
  price: number;
  price_at_purchase: number;
  product_snapshot: ProductSnapshot;
  author_id?: string;
}

interface OrderCommission {
  id: string;
  user_id: string;
  total_amount: number;
  subtotal_amount: number;
  shipping_amount: number;
  shipping_zone_id: string;
  status: string;
  payment_status: string;
  is_paid: boolean;
  order_items: OrderItemCommission[];
}

interface PartnershipService {
  id: string;
  name: string;
  commission_rate: number;
  is_active: boolean;
}

interface SiteSettings {
  author_commission_rate: number;
}

const KOPOKOPO_API_KEY = Deno.env.get("KOPOKOPO_API_KEY") || ""
const KOPOKOPO_WEBHOOK_SECRET = Deno.env.get("KOPOKOPO_WEBHOOK_SECRET") || ""
const KOPOKOPO_CLIENT_ID = Deno.env.get("KOPOKOPO_CLIENT_ID") || ""
const KOPOKOPO_CLIENT_SECRET = Deno.env.get("KOPOKOPO_CLIENT_SECRET") || ""
const KOPOKOPO_ENV = Deno.env.get("KOPOKOPO_ENV") || "sandbox"
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || ""
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") || "ReadMart <no-reply@readmartke.com>"
const FORWARDING_EMAIL = Deno.env.get("FORWARDING_EMAIL") || ""

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

let cachedToken: { token: string; expiry: number } | null = null;

async function getK2Token() {
  if (cachedToken && cachedToken.expiry > Date.now()) return cachedToken.token;

  const authUrl = KOPOKOPO_ENV === 'production' 
    ? 'https://api.kopokopo.com/oauth/token' 
    : 'https://sandbox.kopokopo.com/oauth/token';

  const response = await fetch(authUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: KOPOKOPO_CLIENT_ID,
      client_secret: KOPOKOPO_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }).toString(),
  });

  if (!response.ok) throw new Error(`K2 Token Error: ${await response.text()}`);

  const data = await response.json();
  const expiresIn = data.expires_in || 3600;
  cachedToken = {
    token: data.access_token,
    expiry: Date.now() + (expiresIn - 600) * 1000,
  };
  return data.access_token;
}

async function sendK2SmsNotification(webhookEventId: string, message: string) {
  try {
    const token = await getK2Token();
    const baseUrl = KOPOKOPO_ENV === 'production' ? 'https://api.kopokopo.com' : 'https://sandbox.kopokopo.com';
    
    await fetch(`${baseUrl}/api/v1/transaction_sms_notifications`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        webhook_event_id: webhookEventId,
        content: message
      })
    });
  } catch (e: unknown) {
    console.error('Failed to send K2 SMS:', (e as Error).message);
  }
}



async function verifySignature(body: string, signature: string | null): Promise<boolean> {
  const secret = (KOPOKOPO_WEBHOOK_SECRET || KOPOKOPO_API_KEY).trim()
  if (!signature || !secret) return false
  
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify", "sign"]
  )
  
  // Try Hex verification first (standard for K2)
  try {
    const signatureBytes = new Uint8Array(
      signature.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    )
    const isValidHex = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(body)
    )
    if (isValidHex) return true
  } catch (e: unknown) {
    // Fall through to Base64 verification if Hex verification fails
  }

  // Fallback to Base64 verification
  try {
    const binaryString = atob(signature)
    const signatureBytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      signatureBytes[i] = binaryString.charCodeAt(i)
    }
    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(body)
    )
  } catch (e: unknown) {
    // Return false if both Hex and Base64 verification methods fail
    return false
  }
}

function extractK2WebhookData(payload: Record<string, any>): K2WebhookData {
  const data = payload.data?.attributes || payload.attributes || payload;
  const event = payload.event || data.event || {};
  const resource = event.resource || data.resource || payload.resource || {};
  const metadata = data.metadata || payload.metadata || resource.metadata || {};

  const eventType = String(
    payload.topic ||              
    payload.data?.type ||         
    event.type ||                 
    data.type || 
    payload.type ||
    ""
  );

  const status = data.status || payload.status || resource.status;
  const transactionId = payload.data?.id || data.id || payload.id || resource.transaction_id;
  
  return {
    webhookEventId: String(payload.id || payload.data?.id || ""),
    transactionId: String(transactionId || ""),
    eventType,
    status: String(status || ""),
    amount: parseFloat(data.amount?.value || data.amount || resource.amount || "0"),
    currency: String(data.amount?.currency || data.currency || resource.currency || "KES"),
    phone: String(data.subscriber?.phone_number || data.phone || resource.phone_number || ""),
    senderName: data.subscriber?.first_name ? `${data.subscriber.first_name} ${data.subscriber.last_name || ''}` : String(data.sender_name || ""),
    orderId: String(metadata.order_id || metadata.reference || data.reference || ""),
    isSuccess: status === 'Success' || status === 'Sent' || status === 'Completed' || eventType === 'buygoods_transaction_received'
  };
}

async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html?: string;
  body?: string;
  from?: string;
  bcc?: string | string[];
  replyTo?: string;
}) {
  const { to, subject, html, body, bcc, replyTo } = params;
  const fromAddr = params.from || EMAIL_FROM;
  const recipient = Array.isArray(to) ? to.join(', ') : to;

  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set. Email notification skipped.');
    return { success: false, error: 'RESEND_API_KEY not set' };
  }

  // 1. Log initiation
  let logEntry: { id: string } | null = null;
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
    
    if (!error && data) logEntry = data as { id: string };
  } catch (e: unknown) {
    console.warn('Notification logging failed, proceeding:', (e as Error).message);
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddr,
        to: Array.isArray(to) ? to : [to],
        bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
        reply_to: replyTo,
        subject,
        html: html || `<pre>${body}</pre>`,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', result);
      if (logEntry?.id) {
        await supabase.from('notification_logs').update({ 
          status: 'failed', 
          error_message: result.message || JSON.stringify(result) 
        }).eq('id', logEntry.id);
      }
      return { success: false, error: result.message };
    }

    if (logEntry?.id) {
      await supabase.from('notification_logs').update({ 
        status: 'sent', 
        resend_id: result.id 
      }).eq('id', logEntry.id);
    }

    return { success: true, data: result };
  } catch (err: unknown) {
    console.error('Failed to send email:', (err as Error).message);
    if (logEntry?.id) {
      await supabase.from('notification_logs').update({ 
        status: 'failed', 
        error_message: String(err) 
      }).eq('id', logEntry.id);
    }
    return { success: false, error: String(err) };
  }
}

function wrapEmailTemplate(content: string, previewText: string = '') {
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
          </div>
        </div>
      </body>
    </html>
  `;
}

function renderOrderConfirmationEmail(data: OrderConfirmationData) {
  const { order, items } = data;
  const id = order.id.slice(0, 8).toUpperCase();
  const formatPrice = (amount: number) => `KES ${Number(amount).toLocaleString()}`;
  
  const itemsHtml = items.map((item: OrderItem) => {
    const isEbook = item.product?.type === 'ebook' || item.product_snapshot?.type === 'ebook' || item.is_ebook;
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
  `;
  return wrapEmailTemplate(html, `Order Confirmed - #${id}`);
}

function renderFailedPaymentEmail(data: FailedPaymentData) {
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
  `;
  return wrapEmailTemplate(html, `Action Required: Payment failed for order #${id}`);
}

async function createNotification(params: {
  userId: string;
  type: 'order' | 'system' | 'promo';
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}) {
  const { userId, type, title, message, link, metadata } = params;
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert([{ 
        user_id: userId, 
        type, 
        title, 
        message, 
        metadata: { ...metadata, link } 
      }])
      .select('id')
      .single();
    
    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('cache')) {
        await supabase.from('notifications').insert([{ user_id: userId, type, title, message }]);
      } else {
        console.error('Notification error:', error);
      }
    }
    return data;
  } catch (e: unknown) {
    console.error('Notification exception:', (e as Error).message);
  }
}

async function logAction(action: string, resource?: string, payload?: Record<string, unknown>, userId?: string | null) {
  try {
    await supabase.from('audit_logs').insert([{ 
      user_id: userId || null, 
      action, 
      resource, 
      payload: payload || {} 
    }]);
  } catch (e: unknown) {
    console.error('Audit log failed:', (e as Error).message);
  }
}

async function calculateCommissions(orderId: string) {
  console.log(`Calculating commissions for order: ${orderId}`)
  
  // 1. Fetch order and items with hardening
  let order: OrderCommission | null = null
  const { data: initialOrder, error: orderError } = await supabase
    .from('orders')
    .select(`
      id, user_id, total_amount, subtotal_amount, shipping_amount, shipping_zone_id, status, payment_status, is_paid,
      order_items (
        id, product_id, quantity, price, price_at_purchase, product_snapshot, author_id
      )
    `)
    .eq('id', orderId)
    .single() as { data: OrderCommission | null, error: any }

  if (orderError || !initialOrder) {
    if (orderError?.code === 'PGRST204' || orderError?.message?.includes('cache')) {
      console.warn('Orders schema cache issue, retrying with minimal selection')
      const { data: fallbackOrder } = await supabase
        .from('orders')
        .select('id, user_id, total_amount, shipping_amount, shipping_zone_id, status')
        .eq('id', orderId)
        .single() as { data: OrderCommission | null, error: any }
      
      const { data: fallbackItems } = await supabase
        .from('order_items')
        .select('id, product_id, quantity, price, price_at_purchase, product_snapshot')
        .eq('order_id', orderId)
        
      order = fallbackOrder
      if (order) order.order_items = fallbackItems || []
    } else {
      console.error('Error fetching order for commissions:', orderError)
      return
    }
  } else {
    order = initialOrder
  }

  if (!order) return

  // 2. Prevent duplicate calculation
  const { data: existingLedger } = await supabase
    .from('fulfillment_ledger')
    .select('id')
    .eq('order_id', orderId)
    .limit(1)

  if (existingLedger && existingLedger.length > 0) {
    console.log('Commissions already calculated for this order')
    return
  }

  // 3. Fetch active partnership services
  const { data: services } = await supabase
    .from('partnership_services')
    .select('id, name, commission_rate, is_active')
    .eq('is_active', true) as { data: PartnershipService[] | null, error: any }

  const platformService = services?.find((s: PartnershipService) => s.name.toLowerCase().includes('platform') || s.name.toLowerCase().includes('readmart'))
  const authorService = services?.find((s: PartnershipService) => s.name.toLowerCase().includes('author') || s.name.toLowerCase().includes('royalty'))
  const logisticsService = services?.find((s: PartnershipService) => s.name.toLowerCase().includes('logistics') || s.name.toLowerCase().includes('shipping'))

  const ledgerEntries = []

  // 4. Logistics Payout
  if (order.shipping_zone_id && Number(order.shipping_amount) > 0) {
    const { data: zone } = await supabase
      .from('shipping_zones')
      .select('partner_id')
      .eq('id', order.shipping_zone_id)
      .single()

    if (zone?.partner_id) {
      ledgerEntries.push({
        order_id: orderId,
        partner_id: zone.partner_id,
        partner_service_id: logisticsService?.id,
        amount: order.shipping_amount,
        payout_status: 'pending',
        metadata: { type: 'logistics_fulfillment', zone_id: order.shipping_zone_id }
      })
    }
  }

  // 5. Item commissions (Platform & Author)
  let defaultAuthorRate = 70
  try {
    const { data: settings } = await supabase.from('site_settings').select('author_commission_rate').single() as { data: SiteSettings | null, error: any }
    if (settings?.author_commission_rate) defaultAuthorRate = Number(settings.author_commission_rate)
  } catch (e: unknown) {
    console.error('Error fetching site settings:', (e as Error).message);
  }

  for (const item of order.order_items || []) {
    const price = Number(item.price_at_purchase || item.price || 0)
    const quantity = Number(item.quantity || 0)
    const itemTotal = price * quantity
    
    if (itemTotal <= 0) continue

    const platformRate = platformService?.commission_rate || 10.00
    const authorRate = defaultAuthorRate

    // Platform Commission
    ledgerEntries.push({
      order_id: orderId,
      partner_service_id: platformService?.id,
      amount: itemTotal * (platformRate / 100),
      payout_status: 'pending',
      metadata: { type: 'platform_commission', item_id: item.product_id, rate: platformRate }
    })

    // Author Royalty
    const productSnapshot = item.product_snapshot || {}
    const authorId = productSnapshot.author_id || item.author_id
    
    if (authorId) {
      ledgerEntries.push({
        order_id: orderId,
        partner_id: authorId,
        partner_service_id: authorService?.id,
        amount: itemTotal * (authorRate / 100),
        payout_status: 'pending',
        metadata: { type: 'author_royalty', item_id: item.product_id, rate: authorRate }
      })
    }
  }

  if (ledgerEntries.length > 0) {
    const { error: insertError } = await supabase
      .from('fulfillment_ledger')
      .insert(ledgerEntries)
    
    if (insertError) {
      if (insertError.code === 'PGRST204' || insertError.message?.includes('cache')) {
        console.warn('Fulfillment ledger schema cache issue, retrying minimal insert')
        for (const entry of ledgerEntries) {
          await supabase.from('fulfillment_ledger').insert([{ 
            order_id: entry.order_id, 
            amount: entry.amount, 
            payout_status: 'pending' 
          }])
        }
      } else {
        console.error('Error inserting ledger entries:', insertError)
      }
    } else {
      console.log(`Inserted ${ledgerEntries.length} ledger entries`)
    }
  }
}

async function finalizeOrder(orderId: string, transactionId: string, payload: any) {
  console.log(`Finalizing order: ${orderId}`)
  
  // 1. Fetch order with details
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, user_id, total_amount, shipping_address, status')
    .eq('id', orderId)
    .single()

  if (fetchError || !order) {
    console.error('Error fetching order for finalization:', fetchError)
    return
  }

  // 2. Update order status
  const { error: updateError } = await supabase
    .from('orders')
    .update({
      is_paid: true,
      payment_status: 'paid',
      status: 'paid',
      payment_id: transactionId,
      mpesa_receipt_number: transactionId,
      payment_metadata: payload,
      updated_at: new Date().toISOString()
    })
    .eq('id', orderId)

  if (updateError) {
    if (updateError.code === 'PGRST204' || updateError.message?.includes('cache')) {
      await supabase.from('orders').update({ is_paid: true, status: 'paid', payment_id: transactionId }).eq('id', orderId)
    } else {
      console.error('Error updating order status:', updateError)
      return
    }
  }

  // 3. Trigger commission calculation
  await calculateCommissions(orderId)

  // 4. Fetch items for digital check and email
  let items: any[] = []
  try {
    const { data, error } = await supabase
      .from('order_items')
      .select(`
        id, product_id, quantity, price_at_purchase, product_snapshot,
        product:products(id, type, metadata)
      `)
      .eq('order_id', orderId)
    
    if (error) {
      // Fallback for schema cache issues
      const { data: fallbackItems } = await supabase
        .from('order_items')
        .select('id, product_id, quantity, price_at_purchase, product_snapshot')
        .eq('order_id', orderId)
      
      items = await Promise.all((fallbackItems || []).map(async (item: any) => {
        const { data: product } = await supabase.from('products').select('id, type, metadata').eq('id', item.product_id).maybeSingle()
        return { ...item, product }
      }))
    } else {
      items = data || []
    }
  } catch (e: unknown) {
    console.error('Error fetching items:', (e as Error).message)
  }

  // 5. Digital order activation
  const isDigitalOnly = items.length > 0 && items.every((item: any) => 
    item.product?.type === 'ebook' || item.product_snapshot?.type === 'ebook' || item.product_snapshot?.category === 'Digital'
  )

  if (isDigitalOnly) {
    console.log(`Order ${orderId} is digital-only. Marking as completed.`)
    await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId)
  }

  // 6. Notifications
  if (order.user_id) {
    await createNotification({
      userId: order.user_id,
      type: 'order',
      title: 'Payment Received!',
      message: `Your payment of KES ${order.total_amount} for order #${order.id.slice(0, 8).toUpperCase()} was successful.${isDigitalOnly ? ' Your ebooks are now available.' : ''}`,
      link: isDigitalOnly ? '/account?tab=ebooks' : `/account?tab=orders`
    })
  }

  // 7. Email Confirmation
  try {
    const email = order.shipping_address?.email
    if (email) {
      const processedItems = items.map(item => ({
        ...item,
        is_ebook: item.product?.type === 'ebook' || item.product_snapshot?.type === 'ebook',
        ebook_password: item.product?.metadata?.ebook_password || item.product_snapshot?.metadata?.ebook_password
      }))

      const html = renderOrderConfirmationEmail({ order, items: processedItems })
      
      await sendEmail({
        to: email,
        bcc: FORWARDING_EMAIL,
        subject: `Order Confirmed - #${order.id.slice(0, 8).toUpperCase()}`,
        html
      })
    }
  } catch (e: unknown) {
     console.error('Email confirmation failed:', (e as Error).message)
  }

  console.log(`Order ${orderId} finalized.`)
}

async function handleMembershipPayment(orderId: string, transactionId: string, webhookData: any, payload: any) {
  console.log(`Processing membership payment for order ${orderId}`)
  
  // 1. Fetch payment record
  const { data: payment, error: fetchError } = await supabase
    .from('membership_payments')
    .select('id, user_id, amount, status, metadata')
    .or(`payment_id.eq.${transactionId},metadata->>order_id.eq.${orderId}`)
    .maybeSingle()

  if (fetchError || !payment) {
    console.error('Membership payment record not found:', fetchError)
    return
  }

  if (payment.status === 'completed') {
    console.log(`Membership payment ${orderId} already completed. Skipping.`)
    return
  }

  // 2. Update membership payment status
  const actuallyPaid = webhookData.isSuccess
  const { error: updateError } = await supabase
    .from('membership_payments')
    .update({ 
      status: actuallyPaid ? 'completed' : 'failed',
      payment_id: transactionId,
      metadata: { ...payload, updated_at: new Date().toISOString() }
    })
    .eq('id', payment.id)

  if (updateError) console.error('Error updating membership payment:', updateError)

  if (actuallyPaid) {
    const userId = payment.user_id
    const metadata = payment.metadata || {}
    const isClubMembership = metadata.type === 'club_membership'
    const clubId = metadata.club_id

    if (isClubMembership && clubId) {
      console.log(`Activating club membership for user ${userId} in club ${clubId}`)
      await supabase.from('book_club_members').upsert({
        user_id: userId,
        club_id: clubId,
        status: 'active',
        joined_at: new Date().toISOString()
      }, { onConflict: 'user_id, club_id' })

      await createNotification({
        userId,
        type: 'system',
        title: 'Club Access Unlocked!',
        message: `Welcome to the club! Your membership payment was successful.`,
        link: `/community`
      })
    } else {
      // Standard site membership
      let duration = 30
      const { data: settings } = await supabase.from('site_settings').select('membership_duration_days').maybeSingle()
      if (settings?.membership_duration_days) duration = settings.membership_duration_days
      
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + duration)

      await supabase.from('profiles').update({
        is_member: true,
        membership_started_at: new Date().toISOString(),
        membership_expires_at: expiresAt.toISOString()
      }).eq('id', userId)

      await createNotification({
        userId,
        type: 'system',
        title: 'Membership Activated!',
        message: `Welcome to ReadMart Premium! Your membership is now active until ${expiresAt.toLocaleDateString()}.`,
        link: '/account'
      })
    }

    // Log transaction
    await supabase.from('transactions').insert([{
      user_id: userId,
      amount: payment.amount,
      status: 'success',
      provider: 'kopokopo',
      provider_reference: transactionId,
      metadata: { ...payload, order_id: orderId, type: 'membership_payment' }
    }])
  }
}

async function handleB2CPayout(payload: any, webhookData: any) {
  const { status, transactionId, webhookEventId } = webhookData
  console.log(`Processing B2C payout result: ${status} for transaction ${transactionId}`)
  
  const fulfillmentId = payload.data?.attributes?.metadata?.fulfillment_id || 
                      payload.data?.attributes?.metadata?.fulfillment_ledger_id

  if (fulfillmentId) {
    const isSuccess = status === 'Sent' || status === 'Success'
    const finalPayoutStatus = isSuccess ? 'paid' : 'failed'
    
    const { error: updateError } = await supabase
      .from('fulfillment_ledger')
      .update({ 
        payout_status: finalPayoutStatus,
        metadata: { 
          ...(payload.data?.attributes?.metadata || {}), 
          webhook_event_id: webhookEventId,
          k2_transaction_id: transactionId,
          updated_at: new Date().toISOString()
        }
      })
      .eq('id', fulfillmentId)
    
    if (updateError) console.error(`Failed to update fulfillment ledger ${fulfillmentId}:`, updateError)
    else console.log(`Successfully updated fulfillment ledger ${fulfillmentId} to ${finalPayoutStatus}`)
  } else {
    // Check for author_payout_id in metadata
    const authorPayoutId = payload.data?.attributes?.metadata?.author_payout_id
    if (authorPayoutId) {
      const isSuccess = status === 'Sent' || status === 'Success'
      const finalStatus = isSuccess ? 'completed' : 'failed'
      
      const { error: updateError } = await supabase
        .from('author_payouts')
        .update({ 
          status: finalStatus,
          processed_at: new Date().toISOString(),
          payout_details: { 
            ...(payload.data?.attributes?.metadata || {}), 
            webhook_event_id: webhookEventId,
            k2_transaction_id: transactionId
          }
        })
        .eq('id', authorPayoutId)
      
      if (updateError) console.error(`Failed to update author payout ${authorPayoutId}:`, updateError)
      else console.log(`Successfully updated author payout ${authorPayoutId} to ${finalStatus}`)
    } else {
      console.warn('B2C payout webhook received but no fulfillment_id or author_payout_id found in metadata')
    }
  }
}

async function handleAuthorPayoutRequest(authorId: string, amount: number, phone: string) {
  console.log(`Processing payout request for author ${authorId}: ${amount} to ${phone}`)

  // 1. Verify balance
  const { data: earnings, error: balanceError } = await supabase
    .from('author_earnings')
    .select('current_balance, pending_payouts')
    .eq('author_id', authorId)
    .single()

  if (balanceError || !earnings) {
    console.error('Error fetching author balance:', balanceError)
    return { success: false, error: 'Balance not found' }
  }

  if (Number(earnings.current_balance) < amount) {
    return { success: false, error: 'Insufficient balance' }
  }

  // 2. Create payout record
  const { data: payout, error: payoutError } = await supabase
    .from('author_payouts')
    .insert([{
      author_id: authorId,
      amount,
      status: 'pending',
      payout_method: 'm-pesa',
      payout_details: { phone_number: phone }
    }])
    .select('id')
    .single()

  if (payoutError || !payout) {
    console.error('Error creating payout record:', payoutError)
    return { success: false, error: 'Failed to initiate payout' }
  }

  // 3. Move from current_balance to pending_payouts
  const { error: updateError } = await supabase
    .from('author_earnings')
    .update({
      current_balance: Number(earnings.current_balance) - amount,
      pending_payouts: Number(earnings.pending_payouts || 0) + amount,
      updated_at: new Date().toISOString()
    })
    .eq('author_id', authorId)

  if (updateError) {
    console.error('Error updating author earnings:', updateError)
    // Attempt cleanup
    await supabase.from('author_payouts').update({ status: 'failed', error_message: 'Balance update failed' }).eq('id', payout.id)
    return { success: false, error: 'Balance update failed' }
  }

  // 4. Trigger K2 B2C Payment
  try {
    const token = await getK2Token()
    const baseUrl = KOPOKOPO_ENV === 'production' ? 'https://api.kopokopo.com' : 'https://sandbox.kopokopo.com'
    
    const response = await fetch(`${baseUrl}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        destination_type: 'mobile_wallet',
        destination_reference: phone,
        amount: {
          currency: 'KES',
          value: amount
        },
        description: `Author Payout - ReadMart`,
        category: 'General',
        metadata: {
          author_payout_id: payout.id,
          author_id: authorId
        },
        _links: {
          callback_url: `${SUPABASE_URL}/functions/v1/payments/webhook`
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`K2 B2C Error: ${errorText}`)
    }

    const k2Data = await response.json()
    console.log('K2 B2C initiated:', k2Data)

    await supabase.from('author_payouts').update({ 
      status: 'processing',
      metadata: { k2_location: response.headers.get('location') }
    }).eq('id', payout.id)

    return { success: true, payoutId: payout.id }
  } catch (e: unknown) {
    console.error('K2 B2C payout trigger failed:', (e as Error).message)
    
    // Rollback balance update
    await supabase.from('author_earnings').update({
      current_balance: Number(earnings.current_balance),
      pending_payouts: Number(earnings.pending_payouts || 0),
      updated_at: new Date().toISOString()
    }).eq('author_id', authorId)

    await supabase.from('author_payouts').update({ 
      status: 'failed', 
      error_message: String(e) 
    }).eq('id', payout.id)

    return { success: false, error: String(e) }
  }
}

serve(async (req: Request) => {
  const { method } = req
  const url = new URL(req.url)

  if (method === "POST" && url.pathname.endsWith("/webhook")) {
    const signature = req.headers.get("x-kopokopo-signature") || req.headers.get("x-k2-signature")
    const body = await req.text()
    
    if (!(await verifySignature(body, signature))) {
      console.error('Invalid K2 signature')
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 })
    }

    const payload = JSON.parse(body)
    const webhookData = extractK2WebhookData(payload)
    const { eventType, orderId, transactionId, webhookEventId, status, isSuccess } = webhookData

    console.log(`Webhook received: ${eventType} for order ${orderId}, status ${status}`)

    await logAction('k2_webhook_received', 'payments', {
      eventType,
      webhookEventId,
      transactionId,
      orderId,
      status,
    })

    // 1. Handle B2C Payouts
    if (eventType === "b2c_payment_received" || 
        eventType === "b2c_payment_failed" || 
        eventType === "payment_result") {
      await handleB2CPayout(payload, webhookData)
      return new Response(JSON.stringify({ received: true }), { status: 200 })
    }

    // 2. Handle SMS Notification Result
    if (eventType === "transaction_sms_notification") {
      console.log(`K2 SMS Notification Result: ${status} for event ${webhookEventId}`)
      return new Response(JSON.stringify({ received: true }), { status: 200 })
    }

    // 3. Handle Transaction/Reversal Events
    if (orderId) {
      // Idempotency check
      const { data: existingTx } = await supabase
        .from('transactions')
        .select('id')
        .eq('webhook_event_id', webhookEventId)
        .maybeSingle()

      if (existingTx) {
        console.log(`Webhook event ${webhookEventId} already processed. Skipping.`)
        return new Response(JSON.stringify({ received: true, already_processed: true }), { status: 200 })
      }

      const isReversalEvent = eventType?.includes('reversed') || eventType?.includes('voided')
      
      if (orderId.startsWith('MEMB-')) {
        await handleMembershipPayment(orderId, transactionId, webhookData, payload)
        
        // Send SMS for membership
        if (isSuccess && !isReversalEvent && webhookEventId) {
          const smsMessage = `Confirmed. Your membership payment of ${webhookData.currency} ${webhookData.amount} has been received. Your ReadMart account is now active!`
          await sendK2SmsNotification(webhookEventId, smsMessage)
        }
      } else {
        if (isSuccess && !isReversalEvent) {
          // Log transaction for order
          await supabase.from('transactions').insert({
            order_id: orderId,
            amount: webhookData.amount,
            currency: webhookData.currency,
            status: 'success',
            provider: 'kopokopo',
            provider_reference: transactionId,
            webhook_event_id: webhookEventId,
            metadata: payload
          })

          await finalizeOrder(orderId, transactionId, payload)
                  
                  // Send SMS for order
                  if (webhookEventId) {
                    const smsMessage = `Confirmed. Your payment of ${webhookData.currency} ${webhookData.amount} for order ${orderId} has been received. Thank you for shopping with ReadMart!`
                    await sendK2SmsNotification(webhookEventId, smsMessage)
                  }
                } else if (isReversalEvent) {
                  console.log(`Processing reversal for order ${orderId}`)
                  await supabase.from('orders').update({ 
                    status: 'cancelled', 
                    payment_status: 'refunded' 
                  }).eq('id', orderId)
                } else if (!isSuccess && !orderId.startsWith('MEMB-')) {
                  // Handle failed standard order payment
                  console.log(`Handling failed payment for order ${orderId}`)
                  
                  // Log failed transaction
                  await supabase.from('transactions').insert({
                    order_id: orderId,
                    amount: webhookData.amount,
                    currency: webhookData.currency,
                    status: 'failed',
                    provider: 'kopokopo',
                    provider_reference: transactionId,
                    webhook_event_id: webhookEventId,
                    metadata: payload
                  })

                  // Fetch order to get email
                  const { data: order } = await supabase
                    .from('orders')
                    .select('id, total_amount, shipping_address')
                    .eq('id', orderId)
                    .single()

                  if (order?.shipping_address?.email) {
                    const html = renderFailedPaymentEmail({ order })
                    await sendEmail({
                      to: order.shipping_address.email,
                      subject: `Payment Failed - #${order.id.slice(0, 8).toUpperCase()}`,
                      html
                    })
                  }
                }
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  }

  // Handle Author Payout Request
  if (method === "POST" && url.pathname.endsWith("/author-payout")) {
    try {
      // 1. Authenticate user
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) return new Response(JSON.stringify({ error: "No authorization header" }), { status: 401 })

      const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
      if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })

      // 2. Verify user is an author
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'author') return new Response(JSON.stringify({ error: "Forbidden: Not an author" }), { status: 403 })

      // 3. Process request
      const { amount, phone } = await req.json()
      if (!amount || !phone) return new Response(JSON.stringify({ error: "Amount and phone are required" }), { status: 400 })

      const result = await handleAuthorPayoutRequest(user.id, amount, phone)
      
      if (!result.success) {
        return new Response(JSON.stringify({ error: result.error }), { status: 400 })
      }

      return new Response(JSON.stringify({ success: true, payoutId: result.payoutId }), { status: 200 })
    } catch (e: unknown) {
      console.error('Author payout error:', (e as Error).message)
      return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 })
    }
  }

  return new Response(JSON.stringify({ error: "Not found" }), { status: 404 })
})
