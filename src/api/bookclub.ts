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

  const clubColumns = 'id, name, description, genre, image_url, is_public, meeting_frequency, meeting_format, meeting_platform, is_active, created_at';
  let { data, error } = await supabase
    .from('book_club_members')
    .select(`
      club_id,
      role,
      status,
      book_clubs (${clubColumns})
    `)
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
      console.warn('Advanced book club columns missing from cache, falling back to core columns');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('book_club_members')
        .select(`
          club_id,
          role,
          status,
          book_clubs (id, name, is_active)
        `)
        .eq('user_id', user.id)
        .eq('status', 'active');
      
      if (fallbackError) throw fallbackError;
      data = fallbackData as any;
    } else {
      throw error;
    }
  }

  return (data || []).map(item => ({
    ...(item.book_clubs as any),
    my_role: item.role,
    my_status: item.status
  }));
}

export async function getBookClubDetails(clubId: string) {
  const clubColumns = 'id, name, description, genre, image_url, is_public, require_approval, meeting_frequency, meeting_format, meeting_platform, created_by, is_active, metadata, created_at, updated_at';
  let { data, error } = await supabase
    .from('book_clubs')
    .select(clubColumns)
    .eq('id', clubId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
      console.warn('Advanced book club columns missing from cache, falling back to core columns');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('book_clubs')
        .select('id, name, description, is_active')
        .eq('id', clubId)
        .maybeSingle();
      
      if (fallbackError) throw fallbackError;
      data = fallbackData as any;
    } else {
      throw error;
    }
  }

  return data;
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
