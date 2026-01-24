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

export interface BookClub {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  founder_id: string | null;
  membership_price: number;
  is_active: boolean;
  created_at: string;
  metadata?: {
    category?: string;
    member_limit?: number;
    meeting_frequency?: string;
    active_book?: string;
    members_count?: number;
  };
}

export interface BookClubMembership {
  id: string;
  user_id: string;
  club_id: string;
  status: 'active' | 'pending' | 'expired' | 'cancelled';
  joined_at: string;
  expires_at: string | null;
  payment_status: 'paid' | 'unpaid' | 'pending';
  club?: BookClub;
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

export interface ClubDiscussion {
  id: string;
  club_id: string;
  author_id: string;
  title: string;
  content: string;
  image_url: string | null;
  is_pinned: boolean;
  created_at: string;
  author?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface EventRSVP {
  id: string;
  user_id: string;
  event_id: string;
  status: 'attending' | 'interested' | 'cancelled';
  created_at: string;
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
 * Fetch available book clubs
 */
export async function getAvailableBookClubs(): Promise<BookClub[]> {
  try {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .eq('is_active', true);

    if (error) throw error;
    return (data as BookClub[]) || [];
  } catch (error) {
    console.warn('Clubs fetch failed, returning empty list');
    return [];
  }
}

/**
 * Get a specific book club by ID
 */
export async function getBookClubById(id: string): Promise<BookClub | null> {
  try {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as BookClub;
  } catch (error) {
    return null;
  }
}


/**
 * Join a book club
 */
export async function joinBookClub(clubId: string): Promise<BookClubMembership> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  try {
    // Check for existing membership (One-Club Policy)
    const { data: existing } = await supabase
      .from('club_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      throw new Error('You are already an active member of a book club. Please leave your current club first.');
    }

    const { data, error } = await supabase
      .from('club_members')
      .upsert({ 
        user_id: user.id, 
        club_id: clubId, 
        status: 'active',
        payment_status: 'unpaid' // Default to unpaid until payment flow is integrated
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
      .from('club_members')
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
      .from('club_members')
      .select('*, club:clubs(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')
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

// --- Event RSVP ---

/**
 * RSVP to an event
 */
export async function rsvpToEvent(eventId: string, status: 'attending' | 'interested' | 'cancelled' = 'attending'): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  try {
    const { error } = await supabase
      .from('event_rsvps')
      .upsert({ 
        user_id: user.id, 
        event_id: eventId, 
        status 
      });

    if (error) throw error;
    return true;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to RSVP');
  }
}

/**
 * Get user's RSVPs
 */
export async function getUserRSVPs(): Promise<EventRSVP[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  try {
    const { data, error } = await supabase
      .from('event_rsvps')
      .select('*')
      .eq('user_id', user.id);

    if (error) throw error;
    return (data as EventRSVP[]) || [];
  } catch (error) {
    return [];
  }
}

/**
 * Get all RSVPs for an event (Founder/Admin only)
 */
export async function getEventRSVPs(eventId: string): Promise<(EventRSVP & { profile?: { full_name: string | null, email: string | null } })[]> {
  try {
    const { data, error } = await supabase
      .from('event_rsvps')
      .select('*, profile:profiles(full_name, email)')
      .eq('event_id', eventId);

    if (error) throw error;
    return (data as any[]) || [];
  } catch (error) {
    return [];
  }
}


// --- Club Discussions ---

/**
 * Get discussions/updates for a club
 */
export async function getClubDiscussions(clubId: string): Promise<ClubDiscussion[]> {
  try {
    const { data, error } = await supabase
      .from('club_discussions')
      .select('*, author:profiles(full_name, avatar_url)')
      .eq('club_id', clubId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data as ClubDiscussion[]) || [];
  } catch (error) {
    return [];
  }
}

/**
 * Post a new discussion/update (Founder/Admin only)
 */
export async function postClubDiscussion(clubId: string, payload: { title: string, content: string, image_url?: string, is_pinned?: boolean }): Promise<ClubDiscussion> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  try {
    const { data, error } = await supabase
      .from('club_discussions')
      .insert({
        ...payload,
        club_id: clubId,
        author_id: user.id
      })
      .select()
      .single();

    if (error) throw error;
    return data as ClubDiscussion;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to post discussion');
  }
}

