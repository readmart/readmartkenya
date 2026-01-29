import { supabase } from '../lib/supabase/client';

/**
 * Subscribes an email to the newsletter
 * @param email The email address to subscribe
 * @returns Object with success status and message
 */
export async function subscribeToNewsletter(email: string) {
  try {
    const response = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || result.message || 'Failed to subscribe');
    
    return { success: true, message: result.message };
  } catch (error: any) {
    console.error('Newsletter subscription failed:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to subscribe. Please try again later.',
      message: 'Failed to subscribe. Please try again later.'
    };
  }
}

/**
 * Gets all newsletter subscriptions (Admin only)
 */
export async function getNewsletterSubscriptions() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Check if session exists and user is admin/founder
    let isAdmin = false;
    if (session) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      isAdmin = profile?.role === 'founder' || profile?.role === 'admin';
    } else {
      // Dev bypass
      const devRole = typeof window !== 'undefined' ? localStorage.getItem('rm_dev_role') : null;
      isAdmin = devRole === 'founder' || devRole === 'admin';
    }

    if (!isAdmin) {
      throw new Error('Unauthorized access');
    }

    const { data, error, status } = await supabase
      .from('newsletter_subscriptions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      // If table doesn't exist (404), return empty array instead of throwing
      if (status === 404 || error.code === 'PGRST116' || error.message?.includes('not found')) {
        console.warn('Newsletter subscriptions table not found, returning empty list');
        return [];
      }
      throw error;
    }
    return data || [];
  } catch (err) {
    console.error('Failed to fetch newsletter subscriptions:', err);
    return [];
  }
}

/**
 * Updates a newsletter subscription status
 */
export type NewsletterStatus = 'active' | 'unconfirmed' | 'unsubscribed' | 'paused' | 'deleted';

export async function updateNewsletterStatus(id: string, status: NewsletterStatus) {
  const { data, error } = await supabase
    .from('newsletter_subscriptions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Log the action
  await supabase.from('newsletter_logs').insert([{
    subscription_id: id,
    action: 'status_change',
    metadata: { new_status: status }
  }]);

  return data;
}

/**
 * Batch update subscription statuses
 */
export async function batchUpdateNewsletterStatus(ids: string[], status: NewsletterStatus) {
  const { data, error } = await supabase
    .from('newsletter_subscriptions')
    .update({ status, updated_at: new Date().toISOString() })
    .in('id', ids)
    .select();

  if (error) throw error;

  // Log the actions
  const logs = ids.map(id => ({
    subscription_id: id,
    action: 'status_change',
    metadata: { new_status: status, batch: true }
  }));
  await supabase.from('newsletter_logs').insert(logs);

  return data;
}

/**
 * Search and filter newsletter subscriptions
 */
export async function searchNewsletterSubscriptions(options: {
  searchTerm?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}) {
  const { searchTerm, status, startDate, endDate, page = 1, pageSize = 20 } = options;
  
  let query = supabase
    .from('newsletter_subscriptions')
    .select('*', { count: 'exact' });

  if (searchTerm) {
    query = query.ilike('email', `%${searchTerm}%`);
  }

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (startDate) {
    query = query.gte('created_at', startDate);
  }

  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data, count, page, pageSize };
}
