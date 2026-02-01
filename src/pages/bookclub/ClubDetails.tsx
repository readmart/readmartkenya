import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  BookOpen, 
  MessageSquare, 
  Calendar, 
  Settings, 
  ChevronLeft,
  Plus,
  Send,
  MoreVertical,
  CheckCircle2,
  Clock,
  ExternalLink,
  Lock,
  PieChart,
  Monitor,
  Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  getBookClubDetails, 
  getClubMembers, 
  getClubBooks, 
  getClubDiscussions,
  createDiscussion 
} from '@/api/bookclub';
import { useAuth } from '@/contexts/AuthContext';

const ClubDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [club, setClub] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'discussions' | 'books' | 'members' | 'events'>('discussions');
  const [isMember, setIsMember] = useState(false);
  const [myRole, setMyRole] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchClubData();
  }, [id]);

  const fetchClubData = async () => {
    try {
      setLoading(true);
      const [clubDetails, clubMembers, clubBooks, clubDiscussions] = await Promise.all([
        getBookClubDetails(id!),
        getClubMembers(id!),
        getClubBooks(id!),
        getClubDiscussions(id!)
      ]);

      setClub(clubDetails);
      setMembers(clubMembers || []);
      setBooks(clubBooks || []);
      setDiscussions(clubDiscussions || []);

      const membership = (clubMembers || []).find((m: any) => m.user_id === user?.id);
      if (membership) {
        setIsMember(true);
        setMyRole(membership.role);
      }
    } catch (error: any) {
      toast.error('Failed to load club details');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Club not found</h2>
        <button onClick={() => navigate('/book-club-hub')} className="text-primary font-medium hover:underline">
          Back to Hub
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Club Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate('/book-club-hub')} 
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Back to Book Club Hub"
              >
                <ChevronLeft className="w-5 h-5 text-gray-500" />
              </button>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                {club.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  {club.name}
                  {!club.is_public && <Lock className="w-4 h-4 text-gray-400" />}
                </h1>
                <p className="text-sm text-gray-500">{club.genre} • {members.length} members</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {myRole === 'admin' && (
                <button 
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                  aria-label="Club settings"
                >
                  <Settings className="w-5 h-5" />
                </button>
              )}
              {!isMember && (
                <button className="bg-primary text-white px-6 py-2 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                  Join Club
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-8 mt-6 overflow-x-auto no-scrollbar">
            {[
              { id: 'discussions', label: 'Discussions', icon: MessageSquare },
              { id: 'books', label: 'Reading List', icon: BookOpen },
              { id: 'members', label: 'Members', icon: Users },
              { id: 'events', label: 'Events', icon: Calendar },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 pb-3 px-1 text-sm font-bold transition-all border-b-2 relative ${
                  activeTab === tab.id ? 'text-primary border-primary' : 'text-gray-400 border-transparent hover:text-gray-600'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {activeTab === 'discussions' && (
                <DiscussionsTab 
                  clubId={id!} 
                  discussions={discussions} 
                  isMember={isMember} 
                  onRefresh={fetchClubData} 
                />
              )}
              {activeTab === 'books' && (
                <BooksTab 
                  books={books} 
                  isMember={isMember} 
                  isAdmin={myRole === 'admin'} 
                />
              )}
              {activeTab === 'members' && (
                <MembersTab members={members} />
              )}
              {activeTab === 'events' && (
                <EventsTab club={club} />
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border shadow-sm">
              <h3 className="font-bold text-gray-900 mb-4">About Club</h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                {club.description || 'No description available for this club.'}
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>Meets {club.meeting_frequency}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Monitor className="w-4 h-4 text-primary" />
                  <span>{club.meeting_format === 'online' ? `Online via ${club.meeting_platform}` : 'In-person meeting'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Globe className="w-4 h-4 text-primary" />
                  <span>{club.is_public ? 'Public community' : 'Private circle'}</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-white shadow-lg shadow-primary/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Currently Reading</h3>
                <BookOpen className="w-5 h-5 opacity-50" />
              </div>
              <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm border border-white/20">
                <h4 className="font-bold mb-1">The Great Gatsby</h4>
                <p className="text-white/70 text-sm mb-4">F. Scott Fitzgerald</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span id="reading-progress-label">Reading Progress</span>
                    <span>65%</span>
                  </div>
                  <div 
                    className="h-1.5 bg-white/20 rounded-full overflow-hidden"
                    role="progressbar"
                    aria-valuenow={65}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-labelledby="reading-progress-label"
                  >
                    <div className="h-full bg-white w-[65%]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Sub-components for Tabs ---

const DiscussionsTab: React.FC<{ clubId: string, discussions: any[], isMember: boolean, onRefresh: () => void }> = ({ clubId, discussions, isMember, onRefresh }) => {
  const [showNewPost, setShowNewPost] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title || !content) return toast.error('Please fill in all fields');
    try {
      setSubmitting(true);
      await createDiscussion(clubId, title, content);
      toast.success('Discussion posted!');
      setTitle('');
      setContent('');
      setShowNewPost(false);
      onRefresh();
    } catch (error: any) {
      toast.error('Failed to post discussion');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {isMember && (
        <div className="bg-white rounded-2xl p-6 border shadow-sm">
          {!showNewPost ? (
            <button 
              onClick={() => setShowNewPost(true)}
              className="w-full bg-gray-50 text-gray-500 px-4 py-3 rounded-xl border border-dashed flex items-center gap-3 hover:bg-gray-100 transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Plus className="w-5 h-5" />
              </div>
              Start a new discussion...
            </button>
          ) : (
            <div className="space-y-4">
              <label htmlFor="discussion-title" className="sr-only">Discussion Title</label>
              <input 
                id="discussion-title"
                name="discussion-title"
                type="text" 
                placeholder="Topic title..." 
                className="w-full text-lg font-bold outline-none border-b pb-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <label htmlFor="discussion-content" className="sr-only">Discussion Content</label>
              <textarea 
                id="discussion-content"
                name="discussion-content"
                placeholder="What's on your mind?" 
                rows={4}
                className="w-full outline-none resize-none bg-gray-50 p-4 rounded-xl"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  onClick={() => setShowNewPost(false)}
                  className="px-6 py-2 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-primary text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                >
                  <Send className="w-4 h-4" />
                  Post Discussion
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        {discussions.length > 0 ? discussions.map((discussion) => (
          <div key={discussion.id} className="bg-white rounded-2xl p-6 border shadow-sm hover:border-primary/30 transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                  <img src={discussion.author?.avatar_url || `https://i.pravatar.cc/150?u=${discussion.author_id}`} alt="avatar" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 group-hover:text-primary transition-colors">{discussion.title}</h4>
                  <p className="text-xs text-gray-500">By {discussion.author?.full_name} • {new Date(discussion.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <button className="text-gray-400 hover:text-gray-600">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-600 text-sm line-clamp-3 mb-4">
              {discussion.content}
            </p>
            <div className="flex items-center gap-6 border-t pt-4">
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <MessageSquare className="w-4 h-4" />
                <span>{discussion.comments_count || 0} comments</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Clock className="w-4 h-4" />
                <span>Last activity 2h ago</span>
              </div>
            </div>
          </div>
        )) : (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed">
            <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No discussions yet. Start the conversation!</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const BooksTab: React.FC<{ books: any[], isMember: boolean, isAdmin: boolean }> = ({ isAdmin }) => {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* Currently Reading Section */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Currently Reading
          </h3>
          {isAdmin && (
            <button className="text-primary font-bold text-sm flex items-center gap-1 hover:underline">
              <Plus className="w-4 h-4" />
              Add Book
            </button>
          )}
        </div>
        <div className="bg-white rounded-3xl p-8 border shadow-sm flex flex-col md:flex-row gap-8 items-center">
          <div className="w-40 h-56 bg-gray-100 rounded-xl shadow-lg flex-shrink-0 flex items-center justify-center text-gray-300">
            <BookOpen className="w-12 h-12" />
          </div>
          <div className="flex-1 space-y-4 text-center md:text-left">
            <div>
              <h4 className="text-2xl font-bold text-gray-900">The Great Gatsby</h4>
              <p className="text-gray-500 font-medium">F. Scott Fitzgerald</p>
            </div>
            <p className="text-gray-600 text-sm">
              We are currently exploring the Jazz Age through Jay Gatsby's mysterious parties and unrequited love for Daisy Buchanan.
            </p>
            <div className="pt-4 space-y-2">
              <div className="flex justify-between text-sm font-bold text-gray-900">
                <span>Reading Progress</span>
                <span>65%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-[65%] transition-all duration-1000" />
              </div>
              <div className="flex justify-between text-xs text-gray-500 font-medium">
                <span>Started: Jan 15, 2026</span>
                <span>Goal: Feb 15, 2026</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Finished Books Section */}
      <section>
        <h3 className="text-xl font-bold text-gray-900 mb-6">Reading History</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 border shadow-sm flex gap-4">
              <div className="w-16 h-24 bg-gray-50 rounded-lg flex-shrink-0" />
              <div>
                <h5 className="font-bold text-gray-900">Classic Tale {i}</h5>
                <p className="text-xs text-gray-500 mb-2">Famous Author</p>
                <div className="flex items-center gap-1 text-green-500 text-xs font-bold">
                  <CheckCircle2 className="w-3 h-3" />
                  Completed
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </motion.div>
  );
};

const MembersTab: React.FC<{ members: any[] }> = ({ members }) => {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="p-6 border-b flex justify-between items-center">
        <h3 className="font-bold text-gray-900">All Members ({members.length})</h3>
        <div className="relative">
          <label htmlFor="member-search" className="sr-only">Search members</label>
          <input 
            id="member-search"
            name="member-search"
            type="text" 
            placeholder="Search members..." 
            className="pl-8 pr-4 py-1.5 bg-gray-50 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary/20"
          />
          <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
      </div>
      <div className="divide-y">
        {members.map((member) => (
          <div key={member.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                <img src={member.profile?.avatar_url || `https://i.pravatar.cc/150?u=${member.user_id}`} alt="avatar" />
              </div>
              <div>
                <h5 className="font-bold text-gray-900 text-sm">{member.profile?.full_name || 'Anonymous'}</h5>
                <p className="text-xs text-gray-500 capitalize">{member.role}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">
                Joined {new Date(member.joined_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

const EventsTab: React.FC<{ club: any }> = ({ club }) => {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="bg-white rounded-2xl p-8 border shadow-sm text-center">
        <Calendar className="w-12 h-12 text-primary/20 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">Next Meeting</h3>
        <p className="text-gray-500 mb-6">Saturday, Feb 14 at 7:00 PM</p>
        
        <div className="inline-flex flex-col items-center p-4 bg-primary/5 rounded-2xl border border-primary/10 mb-8">
          <div className="flex items-center gap-2 text-primary font-bold mb-1">
            <Monitor className="w-5 h-5" />
            Online Discussion
          </div>
          <p className="text-sm text-gray-600">Platform: {club.meeting_platform || 'Zoom'}</p>
        </div>

        <div className="flex justify-center gap-4">
          <button className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2">
            <ExternalLink className="w-5 h-5" />
            Join Meeting
          </button>
          <button className="bg-white text-gray-900 border px-8 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all">
            RSVP
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6 border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <PieChart className="w-5 h-5" />
            </div>
            <h4 className="font-bold">Next Book Vote</h4>
          </div>
          <p className="text-sm text-gray-500 mb-4">Help us decide what to read in March!</p>
          <button className="w-full py-2 bg-gray-50 text-gray-900 rounded-lg font-bold text-sm border hover:bg-gray-100 transition-all">
            Cast Your Vote
          </button>
        </div>

        <div className="bg-white rounded-2xl p-6 border shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Users className="w-5 h-5" />
            </div>
            <h4 className="font-bold">Author Q&A</h4>
          </div>
          <p className="text-sm text-gray-500 mb-4">Special guest session with Sarah J. Maas.</p>
          <button className="w-full py-2 bg-gray-50 text-gray-900 rounded-lg font-bold text-sm border hover:bg-gray-100 transition-all">
            View Event
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ClubDetails;
