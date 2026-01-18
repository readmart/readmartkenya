import { supabase } from '@/lib/supabase/client';

export interface CMSContent {
  id: string;
  type: 'banner' | 'hero' | 'event' | 'announcement' | 'book_club';
  title: string;
  content: string | null;
  image_url: string | null;
  link_url: string | null;
  is_active: boolean;
  metadata: any;
  published_at: string;
  created_at: string;
}

export interface BookClubMembership {
  id: string;
  user_id: string;
  club_id: string;
  tier: 'basic' | 'premium' | 'vip';
  is_active: boolean;
  created_at: string;
  club?: CMSContent;
}

export interface Review {
  id: string;
  user_id: string;
  product_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
  product?: {
    title: string;
  };
  // Mock data fields
  user?: string;
  book?: string;
  date?: string;
}

// --- Wishlist Features ---

/**
 * Add a product to the user's wishlist
 */
export async function addToWishlist(productId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data, error } = await supabase
    .from('wishlist_items')
    .insert({ user_id: user.id, product_id: productId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove a product from the user's wishlist
 */
export async function removeFromWishlist(productId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { error } = await supabase
    .from('wishlist_items')
    .delete()
    .eq('user_id', user.id)
    .eq('product_id', productId);

  if (error) throw error;
  return true;
}

/**
 * Get all items in the user's wishlist
 */
export async function getWishlist() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data, error } = await supabase
    .from('wishlist_items')
    .select('*, product:products(*)')
    .eq('user_id', user.id);

  if (error) throw error;
  return data;
}

// --- Book Club Features ---

/**
 * Fetch available book clubs from CMS content
 */
export async function getAvailableBookClubs(): Promise<CMSContent[]> {
  try {
    const { data, error } = await supabase
      .from('cms_content')
      .select('*')
      .eq('type', 'book_club')
      .eq('is_active', true);

    if (error) throw error;
    return (data as CMSContent[]) || [];
  } catch (error) {
    console.warn('CMS Content (book_clubs) fetch failed, returning empty list');
    return [];
  }
}

/**
 * Join a book club
 */
export async function joinBookClub(clubId: string, tier: 'basic' | 'premium' | 'vip' = 'basic'): Promise<BookClubMembership> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  try {
    // Check for existing membership (One-Club Policy)
    const { data: existing } = await supabase
      .from('book_club_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (existing) {
      throw new Error('You are already an active member of a book club. Please leave your current club first.');
    }

    const { data, error } = await supabase
      .from('book_club_memberships')
      .upsert({ 
        user_id: user.id, 
        club_id: clubId, 
        tier,
        is_active: true 
      })
      .select()
      .single();

    if (error) throw error;
    return data as BookClubMembership;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to join book club');
  }
}

/**
 * Leave a book club (deactivate membership)
 */
export async function leaveBookClub(clubId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  try {
    const { error } = await supabase
      .from('book_club_memberships')
      .delete()
      .eq('user_id', user.id)
      .eq('club_id', clubId);

    if (error) throw error;
    return true;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to leave book club');
  }
}

/**
 * Get user's current book club membership
 */
export async function getUserMembership(): Promise<BookClubMembership | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    const { data, error } = await supabase
      .from('book_club_memberships')
      .select('*, club:cms_content(*)')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    return data as BookClubMembership | null;
  } catch (error) {
    console.warn('Book club membership fetch failed, returning null');
    return null;
  }
}

/**
 * Get literary insights from CMS
 */
export async function getInsights(): Promise<CMSContent[]> {
  try {
    const { data, error } = await supabase
      .from('cms_content')
      .select('*')
      .eq('type', 'announcement')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as CMSContent[]) || [];
  } catch (error) {
    console.warn('CMS Content (announcements) fetch failed, returning empty list');
    return [];
  }
}

/**
 * Get upcoming events from CMS
 */
export async function getEvents(): Promise<CMSContent[]> {
  try {
    const { data, error } = await supabase
      .from('cms_content')
      .select('*')
      .eq('type', 'event')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data as CMSContent[]) || [];
  } catch (error) {
    console.warn('CMS Content (events) fetch failed, returning empty list');
    return [];
  }
}

/**
 * Get recent community reviews
 */
export async function getRecentReviews(): Promise<Review[]> {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, profile:profiles(full_name, avatar_url), product:products(title)')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      // Silently handle missing table or RLS issues in production
      if (error.code === 'PGRST116' || error.code === '42P01') {
        console.warn('Reviews table not found or inaccessible, using mock data');
      } else {
        throw error;
      }
      return [
        { id: '1', user_id: '1', product_id: '1', rating: 5, comment: 'The Alchemist changed my perspective on life!', created_at: new Date().toISOString(), user: 'Sarah W.', book: 'The Alchemist', date: '2 days ago' },
        { id: '2', user_id: '2', product_id: '2', rating: 4, comment: 'Great read, highly recommend for tech enthusiasts.', created_at: new Date().toISOString(), user: 'John D.', book: 'Life 3.0', date: '1 week ago' },
        { id: '3', user_id: '3', product_id: '3', rating: 5, comment: 'Beautifully written, a must-read for everyone.', created_at: new Date().toISOString(), user: 'Grace M.', book: 'Creative Minds', date: '3 days ago' },
      ] as Review[];
    }
    return (data as Review[]) || [];
  } catch (error: any) {
    console.warn('Reviews fetch failed:', error.message);
    return [];
  }
}
