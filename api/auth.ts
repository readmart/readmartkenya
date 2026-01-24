import type { VercelRequest, VercelResponse } from '@vercel/node';
import { json, badRequest, serverError, unauthorized, logAction } from './_utils.ts';
import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.VITE_JWT_SECRET || 'fallback_secret_for_dev_min_32_chars'
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  try {
    if (action === 'create-session' && req.method === 'POST') {
      const { userId, email } = req.body;
      if (!userId || !email) return badRequest(res, 'Missing userId or email');

      const role = email === process.env.VITE_FOUNDER_EMAIL ? 'founder' : 'customer';
      
      const token = await new SignJWT({ userId, email, role })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(JWT_SECRET);

      await logAction(req, userId, 'login', 'auth', { email, role });

      return json(res, 200, { token, role });
    }

    if (action === 'verify-session' && req.method === 'GET') {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) return unauthorized(res);
      
      const token = authHeader.split(' ')[1];
      try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return json(res, 200, { valid: true, payload });
      } catch (e) {
        return unauthorized(res, 'Invalid token');
      }
    }

    return json(res, 404, { error: 'Action not found' });
  } catch (err) {
    return serverError(res, err);
  }
}
