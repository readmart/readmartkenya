import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, badRequest, serverError } from './_utils.ts';
import { sendEmail, renderApplicationNotificationEmail, renderApplicationStatusEmail } from './_email.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { action } = req.query;

    // 1. Submit New Application (POST)
    if (req.method === 'POST') {
      const { type, full_name, email, bio, organization, service_type } = req.body;

      if (!type || !full_name || !email) {
        return badRequest(res, 'Missing required fields');
      }

      const table = type === 'author' ? 'author_applications' : 'partnership_applications';
      
      const { data: application, error: dbError } = await supabase
        .from(table)
        .insert([{
          full_name,
          email,
          bio,
          organization,
          service_type,
          status: 'pending'
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      // Notify admin
      const adminEmail = type === 'author' ? 'authors@readmartke.com' : 'partners@readmartke.com';
      await sendEmail({
        to: adminEmail,
        subject: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Application: ${full_name}`,
        html: renderApplicationNotificationEmail(type as 'author' | 'partner', application)
      });

      return json(res, 200, { success: true, id: application.id });
    }

    // 2. Update Application Status (PUT) - Used by Dashboard
    if (req.method === 'PUT') {
      const { id, type, status } = req.body;

      if (!id || !type || !status) {
        return badRequest(res, 'Missing required fields for update');
      }

      const table = type === 'author' ? 'author_applications' : 'partnership_applications';

      const { data: application, error: dbError } = await supabase
        .from(table)
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (dbError) throw dbError;

      // Notify user of status change
      if (status === 'approved' || status === 'rejected') {
        await sendEmail({
          to: application.email,
          subject: `Your ReadMart ${type} application status: ${status}`,
          html: renderApplicationStatusEmail(status as 'approved' | 'rejected', type, application)
        });
      }

      return json(res, 200, { success: true, application });
    }

    return json(res, 405, { error: 'Method not allowed' });

  } catch (err) {
    return serverError(res, err);
  }
}
