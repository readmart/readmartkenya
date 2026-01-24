import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, serverError } from './_utils.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Check DB connection
    const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
    
    if (error) {
      return json(res, 503, { 
        status: 'error', 
        message: 'Database connection failed',
        error: error.message 
      });
    }

    return json(res, 200, { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected'
      }
    });
  } catch (err) {
    return serverError(res, err);
  }
}
