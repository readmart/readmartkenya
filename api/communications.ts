import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, badRequest, serverError, unauthorized, logAction, verifyJWT } from './_utils.js';
import { sendEmail, wrapEmailTemplate } from './_email.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const user = await verifyJWT(req);
    if (!user || (user.role !== 'admin' && user.role !== 'founder')) {
      return unauthorized(res, 'Admin access required');
    }

    const { action } = req.query;

    if (req.method === 'GET') {
      if (action === 'logs') {
        const { data, error } = await supabase
          .from('notification_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);
        
        if (error) throw error;
        return json(res, 200, data);
      }
    }

    if (req.method === 'POST') {
      if (action === 'send') {
        const { to, subject, message, previewText, useTemplate = true } = req.body;
        
        if (!to || !subject || !message) {
          return badRequest(res, 'Missing required fields: to, subject, message');
        }

        const html = useTemplate 
          ? wrapEmailTemplate(`<div style="white-space: pre-wrap;">${message}</div>`, previewText)
          : message;

        const result = await sendEmail({
          to,
          subject,
          html
        });

        if (result.success) {
          await logAction(req, user.userId, 'send_custom_email', 'communications', { to, subject });
          return json(res, 200, { success: true, data: result.data });
        } else {
          return serverError(res, result.error);
        }
      }
    }

    return badRequest(res, 'Invalid action or method');
  } catch (err) {
    return serverError(res, err);
  }
}
