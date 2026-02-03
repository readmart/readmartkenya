import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, badRequest, serverError } from './_utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { type } = req.query;

    if (type === 'book-clubs') {
      const { data, error } = await supabase
        .from('cms_content')
        .select('id, title, content, image_url, metadata, is_active, created_at')
        .eq('type', 'book_club')
        .eq('is_active', true);
      
      if (error) throw error;

      const clubs = (data || []).map(item => ({
        id: item.id,
        name: item.title,
        description: item.content,
        cover_url: item.image_url,
        member_count: item.metadata?.member_count || 0,
        is_active: item.is_active,
        created_at: item.created_at
      }));

      return json(res, 200, clubs);
    }

    if (type === 'discussions') {
      const { clubId } = req.query;
      if (!clubId) return badRequest(res, 'clubId is required');

      const { data, error } = await supabase
        .from('club_discussions')
        .select('id, club_id, author_id, content, created_at, author:profiles(full_name, avatar_url)')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false });
      
      if (error) {
        if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
          console.warn('Advanced club_discussions columns missing, falling back to core columns');
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('club_discussions')
            .select('id, author_id, content, created_at')
            .eq('club_id', clubId)
            .order('created_at', { ascending: false });
          
          if (fallbackError) throw fallbackError;

          // Try to enrich with author names manually if join failed
          const enrichedData = await Promise.all((fallbackData || []).map(async (disc) => {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', disc.author_id)
                .maybeSingle();
              return { ...disc, author: profile };
            } catch (e) {
              return disc;
            }
          }));

          return json(res, 200, enrichedData);
        }
        throw error;
      }
      return json(res, 200, data);
    }

    return json(res, 404, { error: 'Community type not found' });
  } catch (err) {
    return serverError(res, err);
  }
}
