import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, badRequest, serverError, logAction, verifyJWT, unauthorized } from './_utils.js';
import { sendEmail, renderApplicationNotificationEmail, renderApplicationStatusEmail, renderAgreementNotificationEmail, renderActivationNotificationEmail } from './_email.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { action } = req.query;

    // 1. Submit New Application (POST)
    if (req.method === 'POST') {
      const { type, full_name, email, bio, organization, service_type, proof_url, user_id } = req.body;

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
          proof_url,
          user_id, // Link to user if they are logged in
          status: 'pending'
        }])
        .select('id, email, full_name, status')
        .single();

      if (dbError) throw dbError;

      await logAction(req, user_id || null, 'submit_application', table, { applicationId: application.id, type });

      // Notify admin
      const adminEmail = type === 'author' ? 'authors@readmartke.com' : 'partners@readmartke.com';
      const forwardingEmail = process.env.FORWARDING_EMAIL;
      
      await sendEmail({
        to: adminEmail,
        bcc: (forwardingEmail && adminEmail !== forwardingEmail) ? forwardingEmail : undefined,
        subject: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Application: ${full_name}`,
        html: renderApplicationNotificationEmail(type as 'author' | 'partner', application)
      });

      return json(res, 200, { success: true, id: application.id });
    }

    // 2. Update Application Status (PUT) - Used by Dashboard
    if (req.method === 'PUT') {
      const { id, type, status, agreement_url, userId } = req.body;

      if (!id || !type || !status) {
        return badRequest(res, 'Missing required fields for update');
      }

      // Verify authorization
      const user = await verifyJWT(req);
      if (!user || !['admin', 'founder'].includes(user.role)) {
        return unauthorized(res, 'Only admins can update application status');
      }

      const table = type === 'author' ? 'author_applications' : 'partnership_applications';
      
      const updateData: any = { status };
      if (agreement_url) updateData.agreement_url = agreement_url;
      if (userId) updateData.user_id = userId; // Ensure linked if not already

      const { data: application, error: dbError } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', id)
        .select('id, email, full_name, status, bio, organization, service_type, user_id')
        .single();

      if (dbError) throw dbError;

      const targetUserId = userId || application.user_id;

      await logAction(req, user.userId, 'update_application_status', table, { applicationId: application.id, status, targetUserId });

      // Handle successful activation (completed status)
      if (status === 'completed' && targetUserId) {
        console.log(`[Activation] Activating ${type} for user ${targetUserId}`);
        
        // 1. Update Profile Role - This will trigger the DB automation (authors/earnings/partners)
        const role = type === 'author' ? 'author' : 'partner';
        const { error: roleError } = await supabase
          .from('profiles')
          .update({ role })
          .eq('id', targetUserId);
        
        if (roleError) console.error('Role update error:', roleError);

        // 2. Explicitly create/update records to ensure extra fields are set
        // (The trigger handles the basics, we handle the specifics)
        if (type === 'author') {
          await supabase
            .from('authors')
            .upsert({
              id: targetUserId,
              display_name: application.full_name,
              is_verified: true,
              metadata: { 
                application_id: id,
                activated_at: new Date().toISOString()
              }
            });
        } else if (type === 'partner') {
          // Get Bronze tier ID
          const { data: tier } = await supabase
            .from('partnership_tiers')
            .select('id')
            .eq('name', 'Bronze')
            .single();

          await supabase
            .from('partners')
            .upsert({
              user_id: targetUserId,
              company_name: application.organization || application.full_name,
              contact_email: application.email,
              category: application.service_type,
              tier_id: tier?.id,
              status: 'active',
              metadata: {
                application_id: id,
                activated_at: new Date().toISOString()
              }
            }, { onConflict: 'user_id' });
        }
      }

      // Notify user of status change
      if (status === 'approved' || status === 'rejected') {
        await sendEmail({
          to: application.email,
          subject: `Your ReadMart ${type} application status: ${status}`,
          html: renderApplicationStatusEmail(status as 'approved' | 'rejected', type, application)
        });
      } else if (status === 'agreement_sent') {
        await sendEmail({
          to: application.email,
          subject: `ReadMart ${type === 'author' ? 'Author Protocol' : 'Partnership Agreement'} Ready for Review`,
          html: renderAgreementNotificationEmail(type, application)
        });
      } else if (status === 'completed') {
        await sendEmail({
          to: application.email,
          subject: `Account Activated: Welcome to ReadMart ${type === 'author' ? 'Author' : 'Partner'} Program`,
          html: renderActivationNotificationEmail(type, application)
        });
      }

      return json(res, 200, { success: true, application });
    }

    return json(res, 405, { error: 'Method not allowed' });

  } catch (err) {
    return serverError(res, err);
  }
}
