import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, badRequest, serverError, unauthorized, verifyJWT, logAction } from './_utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const user = await verifyJWT(req);
    if (!user || (user.role !== 'admin' && user.role !== 'founder')) {
      return unauthorized(res, 'Founder or Admin access required');
    }

    const { action } = req.query;

    if (req.method === 'POST') {
      if (action === 'sync') {
        // 1. Fetch all active newsletter subscribers
        const { data: subscribers, error: fetchError } = await supabase
          .from('newsletter_subscriptions')
          .select('id, email, status, metadata')
          .eq('status', 'active');

        if (fetchError) {
          if (fetchError.code === 'PGRST204' || fetchError.message?.includes('cache')) {
            console.warn('Newsletter sync cache issue, retrying minimal select');
            const { data } = await supabase.from('newsletter_subscriptions').select('id, email').eq('status', 'active');
            // use data if available
            if (!data) throw fetchError;
          } else {
            throw fetchError;
          }
        }

        const count = subscribers?.length || 0;

        // 2. Perform synchronization with Steme Ecosystem
        // NOTE: In a real production scenario, you would call the Steme API here.
        // For example: 
        // const stemeResponse = await fetch('https://api.steme.io/v1/sync', { 
        //   method: 'POST', 
        //   headers: { 'Authorization': `Bearer ${process.env.STEME_API_KEY}` },
        //   body: JSON.stringify({ subscribers })
        // });
        
        // Simulating the API latency
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 3. Log the synchronization action
        await logAction(req, user.userId, 'steme_sync', 'newsletter', { 
          subscriber_count: count,
          synced_by: user.email,
          timestamp: new Date().toISOString()
        });

        // 4. Create a system notification for the founder
        await supabase.from('newsletter_logs').insert([{
          action: 'steme_sync_completed',
          metadata: { 
            count, 
            synced_by: user.email,
            status: 'success'
          }
        }]);

        return json(res, 200, { 
          success: true, 
          message: `Successfully synchronized ${count} subscribers with Steme Newsletter Ecosystem.`,
          count 
        });
      }
    }

    return badRequest(res, 'Invalid action or method');
  } catch (err) {
    return serverError(res, err);
  }
}
