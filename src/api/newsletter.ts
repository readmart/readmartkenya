import { supabase } from '../lib/supabase/client';

/**
 * Subscribes an email to the newsletter
 * @param email The email address to subscribe
 * @returns Object with success status and message
 */
export async function subscribeToNewsletter(email: string) {
  try {
    const { data, error } = await supabase
      .from('newsletter_subscriptions')
      .insert([{ email, status: 'active' }])
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation (already subscribed)
      if (error.code === '23505') {
        return { success: true, message: 'You are already subscribed!' };
      }
      throw error;
    }

    return { success: true, data, message: 'Successfully subscribed to our newsletter!' };
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
  const { data, error } = await supabase
    .from('newsletter_subscriptions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
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
