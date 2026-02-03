import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, serverError, badRequest } from './_utils.js';
import { remindersHandler } from './_reminders.js';

/**
 * Resend Webhook Handler
 * 
 * Handles incoming webhooks from Resend to track email delivery status,
 * opens, and clicks in the notification_logs table.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS is handled by vercel.json

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const { action } = req.query;

  try {
    if (action === 'reminders') {
      return remindersHandler(req, res);
    }

    const payload = req.body;
    
    // Resend webhooks follow a specific structure
    // { type: "email.delivered", created_at: "...", data: { email_id: "...", ... } }
    const { type, data, created_at } = payload;

    if (!type || !data || !data.email_id) {
      console.warn('Invalid Resend webhook payload received');
      return badRequest(res, 'Invalid payload');
    }

    const resendId = data.email_id;
    const eventType = type;
    
    console.log(`[Resend Webhook] Event: ${eventType}, Email ID: ${resendId}`);

    // Map Resend events to our delivery_status and update timestamps
    const updates: any = {
      // Always store the last event type as the delivery status
      delivery_status: eventType.replace('email.', '')
    };

    // Specific logic for certain events
    if (eventType === 'email.opened') {
      updates.opened_at = created_at || new Date().toISOString();
    } else if (eventType === 'email.clicked') {
      updates.clicked_at = created_at || new Date().toISOString();
    }

    // Update the notification_logs table
    // We use resend_id which was stored during the sendEmail call
    const { data: updated, error } = await supabase
      .from('notification_logs')
      .update(updates)
      .eq('resend_id', resendId)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[Resend Webhook] Database update failed:', error);
      // We still return 200 to Resend to acknowledge receipt, but log the error
      // Resend will retry if we return 500, which might be good for transient DB issues
      return serverError(res, error);
    }

    if (!updated) {
      console.warn(`[Resend Webhook] No matching notification log found for Resend ID: ${resendId}`);
      // Return 200 so Resend doesn't keep retrying for an ID we don't recognize
      return json(res, 200, { received: true, found: false });
    }

    return json(res, 200, { received: true, found: true });
  } catch (err) {
    console.error('[Resend Webhook] Processing error:', err);
    return serverError(res, err);
  }
}
