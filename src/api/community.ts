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
  published_at?: string;
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
    .select('id, user_id, product_id')
    .single();

  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('cache')) {
      console.warn('Wishlist insert cache issue, retrying');
      const { data: retryData, error: retryError } = await supabase
        .from('wishlist_items')
        .insert({ user_id: user.id, product_id: productId })
        .select('id')
        .single();
      
      if (retryError) throw retryError;
      return retryData;
    }
    throw error;
  }
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

  const productColumns = 'id, title, price, sale_price, image_url, category_id, stock_quantity, author_id, type';
  let { data, error } = await supabase
    .from('wishlist_items')
    .select(`
      id, user_id, product_id, created_at,
      product:products(${productColumns})
    `)
    .eq('user_id', user.id);

  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
      console.warn('Advanced wishlist columns missing from cache, falling back to core columns');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('wishlist_items')
        .select(`
          id, user_id, product_id,
          product:products(id, title, price, sale_price)
        `)
        .eq('user_id', user.id);
      
      if (fallbackError) throw fallbackError;
      data = fallbackData as any;
    } else {
      throw error;
    }
  }

  return data;
}

// --- Book Club Features ---

/**
 * Fetch available book clubs
 */
export async function getAvailableBookClubs(): Promise<BookClub[]> {
  try {
    const { data, error } = await supabase
      .from('book_clubs')
      .select('id, name, description, image_url, is_active, metadata, created_at, membership_price, founder_id');

    if (error) throw error;

    return (data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      image_url: item.image_url,
      founder_id: item.founder_id || null,
      membership_price: item.membership_price || 0,
      is_active: item.is_active !== false,
      created_at: item.created_at,
      metadata: item.metadata
    })) as BookClub[];
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
      .from('book_clubs')
      .select('id, name, description, image_url, is_active, metadata, created_at, membership_price, founder_id')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      image_url: data.image_url,
      founder_id: data.founder_id || null,
      membership_price: data.membership_price || 0,
      is_active: data.is_active !== false,
      created_at: data.created_at,
      metadata: data.metadata
    } as BookClub;
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
      .from('book_club_memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      throw new Error('You are already an active member of a book club. Please leave your current club first.');
    }

    const { data, error } = await supabase
      .from('book_club_memberships')
      .upsert({ 
        user_id: user.id, 
        club_id: clubId, 
        status: 'active',
        is_active: true
      })
      .select('id, user_id, club_id, status')
      .single();

    if (error) throw error;
    
    return {
      ...data,
      payment_status: 'paid', // Default for now
      joined_at: new Date().toISOString()
    } as unknown as BookClubMembership;
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
      .select(`
        id, user_id, club_id, status, created_at, expires_at,
        club:book_clubs(id, name, description, image_url, metadata)
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const club = Array.isArray(data.club) ? data.club[0] : data.club;

    return {
      id: data.id,
      user_id: data.user_id,
      club_id: data.club_id,
      status: data.status,
      joined_at: data.created_at,
      expires_at: data.expires_at,
      payment_status: 'paid',
      club: club ? {
        id: club.id,
        name: club.name,
        description: club.description,
        image_url: club.image_url,
        metadata: club.metadata
      } : undefined
    } as unknown as BookClubMembership;
  } catch (error) {
    return null;
  }
}

/**
 * Get literary insights from CMS
 */
export async function getInsights(): Promise<CMSContent[]> {
  try {
    const columns = 'id, title, content, image_url, link_url, is_active, metadata, created_at';
    let { data, error } = await supabase
      .from('announcements')
      .select(columns)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Advanced announcements columns missing, falling back to core');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('announcements')
          .select('id, title, is_active')
          .eq('is_active', true)
          .order('created_at', { ascending: false });
        if (fallbackError) throw fallbackError;
        data = fallbackData as any;
      } else {
        throw error;
      }
    }
    return (data || []).map((d: any) => ({ ...d, type: 'announcement' })) as CMSContent[];
  } catch (error) {
    console.warn('Announcements fetch failed, returning empty list');
    return [];
  }
}

/**
 * Get upcoming events from CMS
 */
export async function getEvents(): Promise<CMSContent[]> {
  try {
    const columns = 'id, title, description, image_url, is_active, metadata, created_at, event_date, location';
    let { data, error } = await supabase
      .from('events')
      .select(columns)
      .eq('is_active', true)
      .order('event_date', { ascending: true });

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Advanced events columns missing, falling back to core');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('events')
          .select('id, name, is_active')
          .eq('is_active', true)
          .order('event_date', { ascending: true });
        if (fallbackError) throw fallbackError;
        data = fallbackData as any;
      } else {
        throw error;
      }
    }
    return (data || []).map((d: any) => ({ 
      ...d, 
      type: 'event', 
      title: d.name || d.title, 
      content: d.description || d.content 
    })) as unknown as CMSContent[];
  } catch (error) {
    console.warn('Events fetch failed, returning empty list');
    return [];
  }
}

/**
 * Get recent community reviews
 */
export async function getRecentReviews(): Promise<Review[]> {
  try {
    const columns = 'id, user_id, product_id, rating, comment, created_at';
    const productColumns = 'title';
    let data: any[] = [];
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select(`
        ${columns},
        product:products(${productColumns})
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && reviews) {
      // Manually fetch profiles from the secure public view
      const userIds = [...new Set(reviews.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      
      const profileMap = Object.fromEntries(profiles?.map((p: any) => [p.id, p]) || []);
      data = reviews.map((r: any) => ({
        ...r,
        profile: profileMap[r.user_id] || null
      }));
    }

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Advanced review columns missing, falling back to core');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('reviews')
          .select(`
            id, rating, comment, created_at,
            profile:profiles(full_name),
            product:products(title)
          `)
          .order('created_at', { ascending: false })
          .limit(10);
        if (fallbackError) throw fallbackError;
        data = fallbackData as any;
      } else if (error.code === 'PGRST116' || error.code === '42P01') {
        console.warn('Reviews table not found or inaccessible');
        return [];
      } else {
        throw error;
      }
    }
    return (data as unknown as Review[]) || [];
  } catch (error: any) {
    console.warn('Reviews fetch failed:', error.message);
    return [];
  }
}

/**
 * Get reviews for a product
 */
export async function getProductReviews(productId: string): Promise<Review[]> {
  try {
    const columns = 'id, user_id, product_id, rating, comment, created_at';
    let data: any[] = [];
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select(columns)
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (!error && reviews) {
      // Manually fetch profiles from the secure public view
      const userIds = [...new Set(reviews.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      
      const profileMap = Object.fromEntries(profiles?.map((p: any) => [p.id, p]) || []);
      data = reviews.map((r: any) => ({
        ...r,
        profile: profileMap[r.user_id] || null
      }));
    }

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Advanced review columns missing from cache, falling back to core columns');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('reviews')
          .select(`
            id, rating, comment, created_at,
            profile:profiles(full_name)
          `)
          .eq('product_id', productId)
          .order('created_at', { ascending: false });
        
        if (fallbackError) throw fallbackError;
        data = fallbackData as any;
      } else {
        throw error;
      }
    }
    return (data as unknown as Review[]) || [];
  } catch (error) {
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
    const columns = 'id, user_id, event_id, status, created_at';
    let { data, error } = await supabase
      .from('event_rsvps')
      .select(columns)
      .eq('user_id', user.id);

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Advanced rsvp columns missing, falling back to core');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('event_rsvps')
          .select('id, user_id, event_id, status')
          .eq('user_id', user.id);
        if (fallbackError) throw fallbackError;
        data = fallbackData as any;
      } else {
        throw error;
      }
    }
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
    const columns = 'id, user_id, event_id, status, created_at';
    let data: any[] = [];
    const { data: rsvps, error } = await supabase
      .from('event_rsvps')
      .select(columns)
      .eq('event_id', eventId);

    if (!error && rsvps) {
      // Manually fetch profiles from the secure public view
      const userIds = [...new Set(rsvps.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);
      
      const profileMap = Object.fromEntries(profiles?.map((p: any) => [p.id, p]) || []);
      data = rsvps.map((r: any) => ({
        ...r,
        profile: profileMap[r.user_id] || null
      }));
    }

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Advanced rsvp columns missing, falling back to core');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('event_rsvps')
          .select(`
            id, user_id, event_id, status,
            profile:profiles(full_name)
          `)
          .eq('event_id', eventId);
        if (fallbackError) throw fallbackError;
        data = fallbackData as any;
      } else {
        throw error;
      }
    }
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
    const columns = 'id, club_id, author_id, title, content, image_url, is_pinned, created_at';
    let data: any[] = [];
    const { data: discussions, error } = await supabase
      .from('club_discussions')
      .select(columns)
      .eq('club_id', clubId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && discussions) {
      // Manually fetch profiles from the secure public view
      const authorIds = [...new Set(discussions.map((d: any) => d.author_id))];
      const { data: profiles } = await supabase
        .from('public_profiles')
        .select('id, full_name, avatar_url')
        .in('id', authorIds);
      
      const profileMap = Object.fromEntries(profiles?.map((p: any) => [p.id, p]) || []);
      data = discussions.map((d: any) => ({
        ...d,
        author: profileMap[d.author_id] || null
      }));
    }

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Advanced discussion columns missing from cache, falling back to core columns');
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('club_discussions')
          .select(`
            id, club_id, author_id, title, is_pinned, created_at,
            author:profiles(full_name)
          `)
          .eq('club_id', clubId)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false });
        
        if (fallbackError) throw fallbackError;
        data = fallbackData as any;
      } else {
        throw error;
      }
    }
    return (data as unknown as ClubDiscussion[]) || [];
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
      .select('id, club_id, author_id, title, content, is_pinned, created_at')
      .single();

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('cache')) {
        console.warn('Discussion post cache issue, retrying');
        const { data: retryData, error: retryError } = await supabase
          .from('club_discussions')
          .insert({
            ...payload,
            club_id: clubId,
            author_id: user.id
          })
          .select('id')
          .single();
        
        if (retryError) throw retryError;
        return retryData as any;
      }
      throw error;
    }
    return data as any;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to post discussion');
  }
}

/**
 * Delete a discussion (Founder/Admin or Author only)
 */
export async function deleteClubDiscussion(discussionId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  try {
    const { error } = await supabase
      .from('club_discussions')
      .delete()
      .eq('id', discussionId);

    if (error) throw error;
    return true;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to delete discussion');
  }
}

/**
 * Post a review for a product
 */
export async function postReview(productId: string, rating: number, comment: string): Promise<Review> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  try {
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        user_id: user.id,
        product_id: productId,
        rating,
        comment
      })
      .select('id, user_id, product_id, rating, comment, created_at')
      .single();

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('cache')) {
        console.warn('Review post cache issue, retrying');
        const { data: retryData, error: retryError } = await supabase
          .from('reviews')
          .insert({
            user_id: user.id,
            product_id: productId,
            rating,
            comment
          })
          .select('id')
          .single();
        
        if (retryError) throw retryError;
        return retryData as any;
      }
      throw error;
    }
    return data as unknown as Review;
  } catch (error: any) {
    throw new Error(error.message || 'Failed to post review');
  }
}

