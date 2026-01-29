import { supabase } from '../lib/supabase/client';

export async function createSession(userId: string, email: string) {
  try {
    const response = await fetch('/api/auth?action=create-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email })
    });
    
    if (!response.ok) throw new Error('Failed to create session');
    
    const { token, role } = await response.json();
    
    // Store token and role
    localStorage.setItem('readmart_token', token);
    localStorage.setItem('readmart_role', role);
    
    return { token, role };
  } catch (error) {
    console.error('Session creation failed:', error);
    return null;
  }
}

export async function getSession() {
  const token = localStorage.getItem('readmart_token');
  if (!token) return null;
  
  try {
    const response = await fetch('/api/auth?action=verify-session', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
      localStorage.removeItem('readmart_token');
      localStorage.removeItem('readmart_role');
      return null;
    }
    
    const { payload } = await response.json();
    return payload;
  } catch (error) {
    return null;
  }
}

export function logout() {
  localStorage.removeItem('readmart_token');
  localStorage.removeItem('readmart_role');
}
