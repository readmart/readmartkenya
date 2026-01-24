import { supabase } from '../lib/supabase/client';

/**
 * Subscribes an email to the newsletter
 * @param email The email address to subscribe
 * @returns Object with success status and message
 */
export async function subscribeToNewsletter(email: string) {
  try {
    const { error } = await supabase
      .from('newsletter_subscriptions')
      .insert([{ email, status: 'active' }]);

    if (error) {
      // Handle unique constraint violation (already subscribed)
      if (error.code === '23505') {
        return { success: true, message: 'You are already subscribed!' };
      }
      throw error;
    }

    return { success: true, message: 'Successfully subscribed to our newsletter!' };
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
export async function updateNewsletterStatus(id: string, status: 'active' | 'unsubscribed') {
  const { data, error } = await supabase
    .from('newsletter_subscriptions')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
