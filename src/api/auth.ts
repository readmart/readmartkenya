import { SignJWT, jwtVerify } from 'jose';
import { supabase } from '../lib/supabase/client';

const JWT_SECRET = new TextEncoder().encode(
  import.meta.env.VITE_JWT_SECRET || 'fallback_secret_for_dev_min_32_chars'
);

export async function createSession(userId: string, email: string) {
  const role = email === import.meta.env.VITE_FOUNDER_EMAIL ? 'founder' : 'customer';
  
  // Grant initial founder/admin rights if email matches env
  if (role === 'founder') {
    await supabase
      .from('profiles')
      .update({ role: 'founder' })
      .eq('id', userId);
  }

  const token = await new SignJWT({ userId, email, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);

  return token;
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch (error) {
    return null;
  }
}
