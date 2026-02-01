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
      let { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
      
      if (profileError && (profileError.code === 'PGRST204' || profileError.message?.includes('cache'))) {
        console.warn('Profiles cache issue, retrying');
        const { data: retryProfile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
        profile = retryProfile;
      }
      
      isAdmin = profile?.role === 'founder' || profile?.role === 'admin';
    } else {
      // Dev bypass
      const devRole = typeof window !== 'undefined' ? localStorage.getItem('rm_dev_role') : null;
      isAdmin = devRole === 'founder' || devRole === 'admin';
    }

    if (!isAdmin) {
      throw new Error('Unauthorized access');
    }

    const columns = 'id, email, status, metadata, created_at, updated_at';
    let { data, error, status: responseStatus } = await supabase
      .from('newsletter_subscriptions')
      .select(columns)
      .order('created_at', { ascending: false });

    if (error) {
      // Handle schema cache issues (PGRST204)
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Advanced newsletter columns missing from cache, falling back to core columns');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('newsletter_subscriptions')
          .select('id, email, status, created_at')
          .order('created_at', { ascending: false });
        
        if (fallbackError) throw fallbackError;
        data = fallbackData as any;
      } else if (responseStatus === 404 || error.code === 'PGRST116' || error.message?.includes('not found')) {
        // If table doesn't exist (404), return empty array instead of throwing
        console.warn('Newsletter subscriptions table not found, returning empty list');
        return [];
      } else {
        throw error;
      }
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
export type NewsletterStatus = 'active' | 'unsubscribed';

export async function updateNewsletterStatus(id: string, status: NewsletterStatus) {
  let { data, error } = await supabase
    .from('newsletter_subscriptions')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, status')
    .single();

  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('cache')) {
      console.warn('Newsletter update cache issue, retrying');
      const { data: retryData, error: retryError } = await supabase
        .from('newsletter_subscriptions')
        .update({ status })
        .eq('id', id)
        .select('id')
        .single();
      
      if (retryError) throw retryError;
      data = retryData as any;
    } else {
      throw error;
    }
  }

  // Log the action
  try {
    await supabase.from('newsletter_logs').insert([{
      subscription_id: id,
      action: 'status_update',
      metadata: { new_status: status }
    }]);
  } catch (e) {
    console.warn('Failed to log newsletter action:', e);
  }

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
    .select('id, status');

  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('cache')) {
      console.warn('Newsletter batch update cache issue, retrying');
      const { data: retryData, error: retryError } = await supabase
        .from('newsletter_subscriptions')
        .update({ status })
        .in('id', ids)
        .select('id');
      
      if (retryError) throw retryError;
      return retryData;
    }
    throw error;
  }

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
  
  const columns = 'id, email, status, metadata, created_at, updated_at';
  let query = supabase
    .from('newsletter_subscriptions')
    .select(columns, { count: 'exact' });

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

  let { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
      console.warn('Advanced newsletter columns missing from cache, falling back to core columns');
      let fallbackQuery = supabase
        .from('newsletter_subscriptions')
        .select('id, email, status, created_at', { count: 'exact' });
      
      if (searchTerm) fallbackQuery = fallbackQuery.ilike('email', `%${searchTerm}%`);
      if (status && status !== 'all') fallbackQuery = fallbackQuery.eq('status', status);
      if (startDate) fallbackQuery = fallbackQuery.gte('created_at', startDate);
      if (endDate) fallbackQuery = fallbackQuery.lte('created_at', endDate);

      const { data: fallbackData, error: fallbackError, count: fallbackCount } = await fallbackQuery
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (fallbackError) throw fallbackError;
      data = fallbackData as any;
      count = fallbackCount;
    } else {
      throw error;
    }
  }
  return { data, count, page, pageSize };
}
