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
  // Development bypass: Check localStorage for dev role first
  // ONLY allowed in development environment
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const devRole = localStorage.getItem('rm_dev_role');
    if (devRole && allowedRoles.includes(devRole)) {
      return { user: { id: 'dev-id' } }; // Mock session for dev
    }
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (!profile || !allowedRoles.includes(profile.role)) {
    throw new Error('Unauthorized access: Required privileges missing');
  }
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
