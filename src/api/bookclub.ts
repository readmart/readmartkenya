import { supabase } from '@/lib/supabase/client';

export interface BookClub {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  image_url: string | null;
  is_public: boolean;
  require_approval: boolean;
  meeting_frequency: string | null;
  meeting_format: string | null;
  meeting_platform: string | null;
  created_by: string | null;
  is_active: boolean;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface BookClubMember {
  id: string;
  club_id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'member';
  status: 'active' | 'pending' | 'invited' | 'banned';
  joined_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface BookClubBook {
  id: string;
  club_id: string;
  product_id: string | null;
  title: string;
  author: string | null;
  status: 'reading' | 'finished' | 'upcoming';
  start_date: string | null;
  end_date: string | null;
  progress_tracking: any[];
  created_at: string;
}

export interface BookClubDiscussion {
  id: string;
  club_id: string;
  author_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  author?: {
    full_name: string | null;
    avatar_url: string | null;
  };
  comments_count?: number;
}

// --- Club Management ---

export async function getMyBookClubs() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let { data, error } = await supabase
    .from('book_club_memberships')
    .select(`
      club_id,
      status,
      club:cms_content(id, title, content, image_url, metadata, is_active, created_at)
    `)
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (error) throw error;

  return (data || []).map(m => {
    const club = Array.isArray(m.club) ? m.club[0] : m.club;
    return {
      club_id: m.club_id,
      role: 'member', // Default since book_club_memberships doesn't have role
      status: m.status,
      book_club: club ? {
        id: club.id,
        name: club.title,
        description: club.content,
        image_url: club.image_url,
        is_active: club.is_active,
        created_at: club.created_at,
        metadata: club.metadata
      } : null
    };
  });
}

export async function getBookClub(id: string) {
  let { data, error } = await supabase
    .from('cms_content')
    .select('id, title, content, image_url, metadata, is_active, created_at')
    .eq('id', id)
    .eq('type', 'book_club')
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    name: data.title,
    description: data.content,
    image_url: data.image_url,
    is_active: data.is_active,
    created_at: data.created_at,
    metadata: data.metadata
  } as unknown as BookClub;
}

export async function createBookClub(clubData: Partial<BookClub>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data, error } = await supabase
    .from('book_clubs')
    .insert({
      ...clubData,
      created_by: user.id
    })
    .select('id, name, description, is_active')
    .single();

  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('cache')) {
      console.warn('Club create cache issue, retrying');
      const { data: retryData, error: retryError } = await supabase
        .from('book_clubs')
        .insert({
          ...clubData,
          created_by: user.id
        })
        .select('id')
        .single();
      
      if (retryError) throw retryError;
      return retryData;
    }
    throw error;
  }

  // Automatically add creator as admin
  await supabase.from('book_club_members').insert({
    club_id: data.id,
    user_id: user.id,
    role: 'admin',
    status: 'active'
  });

  return data;
}

// --- Member Management ---

export async function getClubMembers(clubId: string) {
  const profileColumns = 'full_name, avatar_url';
  let { data, error } = await supabase
    .from('book_club_members')
    .select(`
      id, club_id, user_id, role, status, joined_at,
      profile:profiles (${profileColumns})
    `)
    .eq('club_id', clubId);

  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
      console.warn('Advanced profile columns missing from cache, falling back to core columns');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('book_club_members')
        .select(`
          id, club_id, user_id, role, status, joined_at,
          profile:profiles (full_name)
        `)
        .eq('club_id', clubId);
      
      if (fallbackError) throw fallbackError;
      data = fallbackData as any;
    } else {
      throw error;
    }
  }

  return data;
}

export async function joinBookClub(clubId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  let requireApproval = false;
  try {
    const { data: club, error: clubError } = await supabase
      .from('book_clubs')
      .select('require_approval')
      .eq('id', clubId)
      .single();
    
    if (clubError) {
      if (clubError.code === 'PGRST204' || clubError.message?.includes('cache')) {
        console.warn('Club settings cache issue, defaulting to no approval');
      } else {
        throw clubError;
      }
    }
    requireApproval = club?.require_approval || false;
  } catch (e) {
    console.warn('Failed to fetch club approval setting', e);
  }

  const status = requireApproval ? 'pending' : 'active';

  const { data, error } = await supabase
    .from('book_club_members')
    .insert({
      club_id: clubId,
      user_id: user.id,
      role: 'member',
      status
    })
    .select('id, club_id, user_id, role, status')
    .single();

  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('cache')) {
      console.warn('Club join cache issue, retrying');
      const { data: retryData, error: retryError } = await supabase
        .from('book_club_members')
        .insert({
          club_id: clubId,
          user_id: user.id,
          role: 'member',
          status
        })
        .select('id')
        .single();
      
      if (retryError) throw retryError;
      return retryData;
    }
    throw error;
  }
  return data;
}

// --- Reading List ---

export async function getClubBooks(clubId: string) {
  const columns = 'id, club_id, product_id, title, author, status, start_date, end_date, progress_tracking, created_at';
  let { data, error } = await supabase
    .from('book_club_books')
    .select(columns)
    .eq('club_id', clubId)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
      console.warn('Advanced book club books columns missing from cache, falling back to core columns');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('book_club_books')
        .select('id, club_id, title, status, created_at')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false });
      
      if (fallbackError) throw fallbackError;
      data = fallbackData as any;
    } else {
      throw error;
    }
  }

  return data;
}

// --- Discussions ---

export async function getClubDiscussions(clubId: string) {
  const columns = 'id, club_id, author_id, title, content, is_pinned, created_at, updated_at';
  const profileColumns = 'full_name, avatar_url';
  let { data, error } = await supabase
    .from('book_club_discussions')
    .select(`
      ${columns},
      author:profiles (${profileColumns})
    `)
    .eq('club_id', clubId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
      console.warn('Advanced discussion columns missing from cache, falling back to core columns');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('book_club_discussions')
        .select(`
          id, club_id, author_id, title, is_pinned, created_at,
          author:profiles (full_name)
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

  return data;
}

export async function createDiscussion(clubId: string, title: string, content: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data, error } = await supabase
    .from('book_club_discussions')
    .insert({
      club_id: clubId,
      author_id: user.id,
      title,
      content
    })
    .select('id, club_id, author_id, title, content, created_at')
    .single();

  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('cache')) {
      console.warn('Club discussion create cache issue, retrying');
      const { data: retryData, error: retryError } = await supabase
        .from('book_club_discussions')
        .insert({
          club_id: clubId,
          author_id: user.id,
          title,
          content
        })
        .select('id')
        .single();
      
      if (retryError) throw retryError;
      return retryData;
    }
    throw error;
  }
  return data;
}
