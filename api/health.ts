import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, serverError } from './_utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Check DB connection
    const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    
    // Check K2 Configuration
    const k2Config = {
      clientId: !!process.env.KOPOKOPO_CLIENT_ID,
      clientSecret: !!process.env.KOPOKOPO_CLIENT_SECRET,
      apiKey: !!process.env.KOPOKOPO_API_KEY,
      tillNumber: !!process.env.KOPOKOPO_TILL_NUMBER,
      env: process.env.KOPOKOPO_ENV || 'not set',
      webhookSecret: !!process.env.KOPOKOPO_WEBHOOK_SECRET,
      webhookUrl: !!process.env.KOPOKOPO_WEBHOOK_URL,
      baseUrl: process.env.KOPOKOPO_BASE_URL || 'default'
    };

    if (error) {
      return json(res, 503, { 
        status: 'error', 
        message: 'Database connection failed',
        error: error.message,
        k2Config
      });
    }

    return json(res, 200, { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        k2: k2Config
      }
    });
  } catch (err) {
    return serverError(res, err);
  }
}
