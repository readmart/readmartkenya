import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, badRequest, serverError, unauthorized } from './_utils.js';
import { sendEmail, renderNewsletterConfirmationEmail } from './_email.js';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      const { email } = req.body;
      if (!email) return badRequest(res, 'Email is required');

      // Generate a confirmation token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

      const { data: existing, error: checkError } = await supabase
        .from('newsletter_subscriptions')
        .select('id, status')
        .eq('email', email)
        .single();

      if (existing) {
        if (existing.status === 'active') {
          return json(res, 200, { success: true, message: 'You are already subscribed!' });
        }
        
        // Update existing with new token
        const { error: updateError } = await supabase
          .from('newsletter_subscriptions')
          .update({ 
            status: 'unconfirmed', 
            metadata: { confirmation_token: token, token_expires: expiresAt.toISOString() } 
          })
          .eq('id', existing.id);
          
        if (updateError) throw updateError;
      } else {
        // Create new subscription
        const { error: insertError } = await supabase
          .from('newsletter_subscriptions')
          .insert([{ 
            email, 
            status: 'unconfirmed',
            metadata: { confirmation_token: token, token_expires: expiresAt.toISOString() }
          }]);

        if (insertError) {
          if (insertError.code === '23505') {
            return json(res, 200, { success: true, message: 'You are already subscribed!' });
          }
          throw insertError;
        }
      }

      // Send confirmation email
      const emailResult = await sendEmail({
        to: email,
        subject: 'Confirm your ReadMart Subscription',
        html: renderNewsletterConfirmationEmail({ email, token })
      });

      if (!emailResult.success) {
        console.error('Failed to send confirmation email:', emailResult.error);
        // We still return success to user but log the error
      }

      return json(res, 200, { 
        success: true, 
        message: 'Please check your email to confirm your subscription.' 
      });
    }

    if (req.method === 'GET') {
      const { confirm, status: fetchStatus } = req.query;

      // Handle subscription confirmation
      if (confirm) {
        const token = confirm as string;
        
        // Find subscription by token in metadata
        const { data: sub, error: findError } = await supabase
          .from('newsletter_subscriptions')
          .select('*')
          .filter('metadata->>confirmation_token', 'eq', token)
          .single();

        if (findError || !sub) {
          return res.redirect('https://readmartke.com/newsletter/error?reason=invalid_token');
        }

        const expires = sub.metadata?.token_expires;
        if (expires && new Date(expires) < new Date()) {
          return res.redirect('https://readmartke.com/newsletter/error?reason=expired');
        }

        // Confirm subscription
        const { error: confirmError } = await supabase
          .from('newsletter_subscriptions')
          .update({ 
            status: 'active',
            metadata: { ...sub.metadata, confirmed_at: new Date().toISOString(), confirmation_token: null }
          })
          .eq('id', sub.id);

        if (confirmError) throw confirmError;

        // Log confirmation
        await supabase.from('newsletter_logs').insert([{
          subscription_id: sub.id,
          action: 'subscription_confirmed',
          metadata: { method: 'email_link' }
        }]);

        return res.redirect('https://readmartke.com/newsletter/success');
      }

      // Admin fetch logic
      const authHeader = req.headers.authorization;
      const token = authHeader?.split(' ')[1];
      if (!token) return unauthorized(res);

      const { data: userData, error: authError } = await supabase.auth.getUser(token);
      const user = userData?.user;
      if (authError || !user) return unauthorized(res);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || !['admin', 'founder'].includes(profile.role)) {
        return unauthorized(res, 'Forbidden');
      }

      const { data, error } = await supabase
        .from('newsletter_subscriptions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return json(res, 200, data);
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return serverError(res, err);
  }
}
