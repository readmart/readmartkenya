import { supabase } from '@/lib/supabase/client';

/**
 * Utility to log administrative actions
 */
export async function logAudit(action: string, entityType: string, entityId: string | null, newData: any = null, oldData: any = null) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;

    const { error } = await supabase.from('audit_logs').insert([{
      user_id: session.user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      new_data: newData,
      old_data: oldData
    }]);

    if (error) {
      if (error.code === 'PGRST204') {
        console.warn('Audit logs table missing, skipping log');
      } else {
        console.warn('Audit logging failed:', error.message);
      }
    }
  } catch (err) {
    console.warn('Audit logging failed (exception):', err);
  }
}

/**
 * Utility to calculate percentage trend between two periods
 */
export function calculateTrend(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const diff = ((current - previous) / previous) * 100;
  return `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%`;
}

/**
 * Utility to verify roles
 */
export async function verifyRole(allowedRoles: string[]) {
  console.log(`[Auth] Verifying role. Allowed: ${allowedRoles.join(', ')}`);
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.error('[Auth] No session found');
    throw new Error('Not authenticated');
  }

  console.log('[Auth] Session user ID:', session.user.id);
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (error) {
    console.error('[Auth] Profile fetch error:', error);
  }

  console.log('[Auth] User profile role:', profile?.role);
  if (!profile || !allowedRoles.includes(profile.role)) {
    console.error(`[Auth] Unauthorized. User role ${profile?.role} not in ${allowedRoles.join(', ')}`);
    throw new Error('Unauthorized access: Required privileges missing');
  }
  
  console.log('[Auth] Authorization successful');
  return session;
}

/**
 * Utility to verify administrative privileges
 */
export async function verifyAdmin() {
  return verifyRole(['founder', 'admin']);
}

/**
 * Utility to verify author privileges
 */
export async function verifyAuthor() {
  return verifyRole(['founder', 'admin', 'author']);
}

/**
 * Utility to verify partner privileges
 */
export async function verifyPartner() {
  return verifyRole(['founder', 'admin', 'partner']);
}
