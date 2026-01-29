import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  BookOpen, 
  Plus, 
  Search, 
  Calendar, 
  ChevronRight,
  Star
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { getMyBookClubs } from '@/api/bookclub';

const BookClubHub: React.FC = () => {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'my-clubs' | 'discover'>('my-clubs');

  useEffect(() => {
    fetchClubs();
  }, []);

  const fetchClubs = async () => {
    try {
      setLoading(true);
      const myClubs = await getMyBookClubs();
      setClubs(myClubs);
    } catch (error: any) {
      toast.error('Failed to load book clubs');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClubs = clubs.filter(club => 
    club.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    club.genre?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      {/* Hero Header */}
      <div className="bg-primary text-white py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row md:items-center justify-between gap-6"
          >
            <div>
              <h1 className="text-4xl font-bold mb-2">Book Club Hub</h1>
              <p className="text-primary-foreground/80 text-lg">
                Manage your literary communities and discover new reading circles.
              </p>
            </div>
            <button 
              onClick={() => navigate('/book-club-hub/create')}
              className="bg-white text-primary px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-gray-100 transition-colors shadow-lg self-start"
            >
              <Plus className="w-5 h-5" />
              Create New Club
            </button>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-8">
        {/* Search & Tabs */}
        <div className="bg-white rounded-2xl shadow-sm border p-4 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex bg-gray-100 p-1 rounded-xl w-full md:w-auto">
            <button 
              onClick={() => setActiveTab('my-clubs')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'my-clubs' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              My Clubs
            </button>
            <button 
              onClick={() => setActiveTab('discover')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'discover' ? 'bg-white shadow-sm text-primary' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Discover
            </button>
          </div>

          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text"
              placeholder="Search clubs by name or genre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
            <p className="text-gray-500">Loading your literary world...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredClubs.length > 0 ? (
                filteredClubs.map((club, index) => (
                  <ClubCard key={club.id} club={club} index={index} />
                ))
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="col-span-full bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center"
                >
                  <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-10 h-10 text-gray-300" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No active book clubs</h3>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto">
                    {activeTab === 'my-clubs' 
                      ? "You haven't joined any book clubs yet. Start your journey by creating one or exploring existing clubs."
                      : "We couldn't find any clubs matching your search."}
                  </p>
                  <div className="flex gap-4 justify-center">
                    <button 
                      onClick={() => navigate('/book-club-hub/create')}
                      className="text-primary font-medium hover:underline"
                    >
                      Create your first club
                    </button>
                    <span className="text-gray-300">|</span>
                    <button 
                      onClick={() => setActiveTab('discover')}
                      className="text-primary font-medium hover:underline"
                    >
                      Browse public clubs
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

const ClubCard: React.FC<{ club: any, index: number }> = ({ club, index }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group bg-white rounded-2xl border hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden"
    >
      <div className="relative h-48 bg-gray-200 overflow-hidden">
        {club.image_url ? (
          <img src={club.image_url} alt={club.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <BookOpen className="w-16 h-16 text-primary/20" />
          </div>
        )}
        <div className="absolute top-4 right-4 flex gap-2">
          {club.is_public ? (
            <span className="bg-green-500/90 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm">Public</span>
          ) : (
            <span className="bg-amber-500/90 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm">Private</span>
          )}
        </div>
        {club.my_role === 'admin' && (
          <div className="absolute top-4 left-4">
            <span className="bg-primary/90 text-white text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm">Owner</span>
          </div>
        )}
      </div>

      <div className="p-6">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-bold text-gray-900 line-clamp-1">{club.name}</h3>
          <div className="flex items-center text-amber-500 text-sm font-medium">
            <Star className="w-4 h-4 fill-current mr-1" />
            4.8
          </div>
        </div>
        
        <p className="text-gray-500 text-sm mb-4 line-clamp-2 min-h-[2.5rem]">
          {club.description || 'No description provided.'}
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          {club.genre && (
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-lg font-medium">
              {club.genre}
            </span>
          )}
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-lg font-medium flex items-center gap-1">
            <Users className="w-3 h-3" />
            {club.members_count || 12} members
          </span>
          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-lg font-medium flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {club.meeting_frequency || 'Monthly'}
          </span>
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 overflow-hidden">
                <img src={`https://i.pravatar.cc/150?u=${i + index}`} alt="member" className="w-full h-full object-cover" />
              </div>
            ))}
            <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
              +8
            </div>
          </div>
          <Link 
            to={`/book-club-hub/${club.id}`}
            className="flex items-center gap-1 text-primary font-bold text-sm hover:gap-2 transition-all"
          >
            Enter Club
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
};

export default BookClubHub;
