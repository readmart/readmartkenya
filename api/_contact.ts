import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, badRequest, serverError, logAction } from './_utils.js';
import { sendEmail, renderContactNotificationEmail } from './_email.js';

export async function contactHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const { name, email, subject, message, attachment_url } = req.body;

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
        attachment_url,
        status: 'New',
        priority: 'Medium'
      }])
      .select('id, full_name, email, subject, message, attachment_url')
      .single();

    if (dbError) {
      if (dbError.code === 'PGRST204' || dbError.message?.includes('column') || dbError.message?.includes('cache')) {
        console.warn('Schema cache issue on contact insert, retrying with minimal select');
        const { data: retryData, error: retryError } = await supabase
          .from('contact_messages')
          .insert([{
            full_name: name,
            email,
            subject,
            message,
            attachment_url,
            status: 'New',
            priority: 'Medium'
          }])
          .select('id')
          .single();
        if (retryError) throw retryError;
        // Mock the rest of the object for the email logic
        return json(res, 200, { success: true, id: retryData.id, message: 'Inquiry received successfully' });
      }
      throw dbError;
    }

    await logAction(req, null, 'submit_contact_form', 'contact_messages', { messageId: contactMsg.id });

    // 2. Determine target department email from subject
    const emailMatch = subject.match(/\((.*?)\)/);
    const departmentEmail = emailMatch ? emailMatch[1].trim() : (process.env.SUPPORT_EMAIL || 'info@readmartke.com');
    const forwardingEmail = process.env.FORWARDING_EMAIL;

    const emailHtml = renderContactNotificationEmail({
      full_name: name,
      email,
      subject,
      message,
      attachment_url
    });

    // 3. Send email notification to department (and BCC forwarding email if set)
    const emailResult = await sendEmail({
      to: departmentEmail,
      subject: `[ReadMart ${subject.split(' (')[0]}] New Inquiry from ${name}`,
      html: emailHtml,
      // If departmentEmail is not the forwarding email, add forwarding email to keep admin in the loop
      bcc: (forwardingEmail && departmentEmail !== forwardingEmail) ? forwardingEmail : undefined
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
