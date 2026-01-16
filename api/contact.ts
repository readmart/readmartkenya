import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, badRequest, serverError } from './_utils.ts';
import { sendEmail, renderContactNotificationEmail } from './_email.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return badRequest(res, 'All fields are required');
  }

  try {
    // 1. Save to database
    const { data: contactMsg, error: dbError } = await supabase
      .from('contact_messages')
      .insert([{
        full_name: name,
        email,
        subject,
        message,
        status: 'New',
        priority: 'Medium'
      }])
      .select()
      .single();

    if (dbError) throw dbError;

    // 2. Send email notification to support
    const supportEmail = process.env.SUPPORT_EMAIL || 'support@readmartke.com';
    const emailHtml = renderContactNotificationEmail({
      full_name: name,
      email,
      subject,
      message
    });

    const emailResult = await sendEmail({
      to: supportEmail,
      subject: `New Inquiry: ${subject}`,
      html: emailHtml
    });

    if (!emailResult.success) {
      console.warn('Notification email failed but message was saved:', emailResult.error);
    }

    return json(res, 200, { 
      success: true, 
      message: 'Inquiry received successfully',
      id: contactMsg.id 
    });

  } catch (err) {
    return serverError(res, err);
  }
}
