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

  const { data, error } = await supabase
    .from('book_club_members')
    .select(`
      club_id,
      role,
      status,
      book_clubs (*)
    `)
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (error) throw error;
  return data.map(item => ({
    ...item.book_clubs,
    my_role: item.role,
    my_status: item.status
  }));
}

export async function getBookClubDetails(clubId: string) {
  const { data, error } = await supabase
    .from('book_clubs')
    .select('*')
    .eq('id', clubId)
    .single();

  if (error) throw error;
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
    .select()
    .single();

  if (error) throw error;

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
  const { data, error } = await supabase
    .from('book_club_members')
    .select(`
      *,
      profile:profiles (full_name, avatar_url)
    `)
    .eq('club_id', clubId);

  if (error) throw error;
  return data;
}

export async function joinBookClub(clubId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data: club } = await supabase
    .from('book_clubs')
    .select('require_approval')
    .eq('id', clubId)
    .single();

  const status = club?.require_approval ? 'pending' : 'active';

  const { data, error } = await supabase
    .from('book_club_members')
    .insert({
      club_id: clubId,
      user_id: user.id,
      role: 'member',
      status
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// --- Reading List ---

export async function getClubBooks(clubId: string) {
  const { data, error } = await supabase
    .from('book_club_books')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

// --- Discussions ---

export async function getClubDiscussions(clubId: string) {
  const { data, error } = await supabase
    .from('book_club_discussions')
    .select(`
      *,
      author:profiles (full_name, avatar_url)
    `)
    .eq('club_id', clubId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
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
    .select()
    .single();

  if (error) throw error;
  return data;
}
