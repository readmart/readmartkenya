import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, badRequest, serverError, unauthorized } from './_utils.js';
import { contactHandler } from './_contact.js';
import { sendEmail, renderNewsletterConfirmationEmail } from './_email.js';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  try {
    if (action === 'contact') {
      return contactHandler(req, res);
    }

    if (req.method === 'POST') {
      const { email } = req.body;
      if (!email) return badRequest(res, 'Email is required');

      // Generate a confirmation token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

      let { data: existing, error: checkError } = await supabase
        .from('newsletter_subscriptions')
        .select('id, status')
        .eq('email', email)
        .maybeSingle();

      if (checkError) {
        if (checkError.code === 'PGRST204' || checkError.message?.includes('cache')) {
          console.warn('Newsletter check cache issue, retrying minimal select');
          const { data } = await supabase.from('newsletter_subscriptions').select('id, status').eq('email', email).maybeSingle();
          existing = data;
        }
      }

      if (existing) {
        if (existing.status === 'active') {
          return json(res, 200, { success: true, message: 'You are already subscribed!' });
        }
        
        // Update existing with new token
        const { error: updateError } = await supabase
          .from('newsletter_subscriptions')
          .update({ 
            status: 'active', 
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
            status: 'active',
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
        const publicDomain = process.env.PUBLIC_DOMAIN || 'readmartke.com';
        const protocol = publicDomain.includes('localhost') ? 'http' : 'https';
        const baseUrl = `${protocol}://${publicDomain}`;
        
        // Find subscription by token in metadata - using explicit columns for cache resilience
        const columns = 'id, email, status, metadata, created_at';
        let { data: sub, error: findError } = await supabase
          .from('newsletter_subscriptions')
          .select(columns)
          .filter('metadata->>confirmation_token', 'eq', token)
          .maybeSingle();

        if (findError) {
          // Handle schema cache issues (PGRST204)
          if (findError.code === 'PGRST204' || findError.message?.includes('column') || findError.message?.includes('cache')) {
            console.warn('Advanced newsletter columns missing from cache, falling back to core columns');
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('newsletter_subscriptions')
              .select('id, email, status')
              .filter('metadata->>confirmation_token', 'eq', token)
              .maybeSingle();
            
            if (fallbackError) throw fallbackError;
            sub = fallbackData as any;
          } else {
            throw findError;
          }
        }

        if (!sub) {
          return res.redirect(`${baseUrl}/newsletter/error?reason=invalid_token`);
        }

        const expires = sub.metadata?.token_expires;
        if (expires && new Date(expires) < new Date()) {
          return res.redirect(`${baseUrl}/newsletter/error?reason=expired`);
        }

      // Update subscription confirmation
      try {
        const { error: confirmError } = await supabase
          .from('newsletter_subscriptions')
          .update({ 
            status: 'active',
            metadata: { ...sub.metadata, confirmed_at: new Date().toISOString(), confirmation_token: null }
          })
          .eq('id', sub.id);

        if (confirmError) {
          if (confirmError.code === 'PGRST204' || confirmError.message?.includes('cache')) {
            console.warn('Newsletter update cache issue, retrying minimal update');
            await supabase
              .from('newsletter_subscriptions')
              .update({ status: 'active' })
              .eq('id', sub.id);
          } else {
            throw confirmError;
          }
        }

        // Log confirmation - hardened
        try {
          const { error: logError } = await supabase.from('newsletter_logs').insert([{
            subscription_id: sub.id,
            action: 'subscription_confirmed',
            metadata: { method: 'email_link' }
          }]);
          
          if (logError && (logError.code === 'PGRST204' || logError.message?.includes('cache'))) {
            console.warn('Newsletter logs cache issue, retrying minimal log');
            await supabase.from('newsletter_logs').insert([{
              action: 'system_log_retry',
              metadata: { original_action: 'newsletter_confirmation', sub_id: sub.id }
            }]);
          }
        } catch (e) {
          console.error('Failed to log newsletter confirmation:', e);
        }

        return res.redirect(`${baseUrl}/newsletter/success`);
      } catch (err) {
        console.error('Newsletter confirmation failed:', err);
        return res.redirect(`${baseUrl}/newsletter/error?reason=update_failed`);
      }
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
        .select('id, email, status, created_at, metadata')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
          console.warn('Advanced newsletter columns missing, falling back to core columns');
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('newsletter_subscriptions')
            .select('id, email, status, created_at')
            .order('created_at', { ascending: false });
          if (fallbackError) throw fallbackError;
          return json(res, 200, fallbackData);
        }
        throw error;
      }
      return json(res, 200, data);
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return serverError(res, err);
  }
}
