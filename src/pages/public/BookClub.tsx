import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  MessageSquare, 
  BookOpen, 
  ArrowRight, 
  Calendar, 
  Lightbulb, 
  Star,
  MapPin,
  Clock,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { 
  getAvailableBookClubs, 
  joinBookClub, 
  leaveBookClub, 
  getUserMembership,
  getInsights,
  getEvents,
  getRecentReviews
} from '@/api/community';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

type Tab = 'communities' | 'insights' | 'reviews' | 'events';

export default function BookClub() {
  const [activeTab, setActiveTab] = useState<Tab>('communities');
  const [clubs, setClubs] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [membership, setMembership] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [clubsData, insightsData, eventsData, reviewsData, membershipData] = await Promise.all([
        getAvailableBookClubs(),
        getInsights(),
        getEvents(),
        getRecentReviews(),
        getUserMembership()
      ]);

      setClubs(clubsData);
      setInsights(insightsData);
      setEvents(eventsData);
      setReviews(reviewsData);
      setMembership(membershipData);
    } catch (error) {
      console.error('Error fetching book club data:', error);
      toast.error('Failed to load community data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinClub = async (clubId: string) => {
    if (!user) {
      toast.error('Please login to join a club');
      return;
    }

    setIsJoining(clubId);
    try {
      await joinBookClub(clubId);
      toast.success('Welcome to the club!');
      const newMembership = await getUserMembership();
      setMembership(newMembership);
    } catch (error: any) {
      toast.error(error.message || 'Failed to join club');
    } finally {
      setIsJoining(null);
    }
  };

  const handleLeaveClub = async (clubId: string) => {
    try {
      await leaveBookClub(clubId);
      toast.success('You have left the club');
      setMembership(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to leave club');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto text-center mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="glass px-4 py-2 rounded-full text-xs font-black text-primary uppercase tracking-[0.2em] mb-6 inline-block">
            Digital Town Square
          </span>
          <h1 className="text-6xl md:text-7xl font-black uppercase tracking-tighter mb-6 leading-none">
            ReadMart <span className="text-primary">Community</span>
          </h1>
          <p className="text-xl text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed">
            The best stories are the ones we share. Join a specialized group, 
            discover literary insights, and connect with fellow book worms.
          </p>
        </motion.div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap justify-center gap-4 mb-12">
        {(['communities', 'insights', 'reviews', 'events'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${
              activeTab === tab 
                ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-105' 
                : 'glass hover:bg-white/10'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Communities Section */}
          {activeTab === 'communities' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {clubs.map((club) => (
                <motion.div
                  key={club.id}
                  whileHover={{ y: -5 }}
                  className={`glass p-8 rounded-[3rem] relative overflow-hidden group ${
                    membership?.club_id === club.id ? 'ring-2 ring-primary bg-primary/5' : ''
                  }`}
                >
                  {membership?.club_id === club.id && (
                    <div className="absolute top-6 right-6 flex items-center gap-2 bg-primary text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                      <ShieldCheck className="w-3 h-3" />
                      Your Club
                    </div>
                  )}
                  
                  <div className="flex justify-between items-start mb-6">
                    <div className="p-4 rounded-2xl bg-secondary/10 text-secondary">
                      <Users className="w-6 h-6" />
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-black mb-4 tracking-tight group-hover:text-primary transition-colors">
                    {club.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6 font-medium">
                    {club.content}
                  </p>
                  
                  <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3 text-sm font-bold">
                      <BookOpen className="w-4 h-4 text-primary" />
                      <span>Reading: {club.metadata?.active_book || 'TBD'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
                      <MessageSquare className="w-4 h-4" />
                      <span>{club.metadata?.members_count || 0} active members</span>
                    </div>
                  </div>
                  
                  {membership?.club_id === club.id ? (
                    <button 
                      onClick={() => handleLeaveClub(club.id)}
                      className="w-full glass text-red-500 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-500 hover:text-white transition-all"
                    >
                      Leave Club
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleJoinClub(club.id)}
                      disabled={isJoining === club.id || membership !== null}
                      className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 ${
                        membership !== null 
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : 'bg-white text-black hover:bg-primary hover:text-white'
                      }`}
                    >
                      {isJoining === club.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : membership !== null ? (
                        'One-Club Policy Active'
                      ) : (
                        <>Join This Club <ArrowRight className="w-4 h-4" /></>
                      )}
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* Insights Section */}
          {activeTab === 'insights' && (
            <div className="grid md:grid-cols-2 gap-8">
              {insights.map((insight) => (
                <motion.div
                  key={insight.id}
                  whileHover={{ y: -5 }}
                  className="glass p-8 rounded-[3rem] group"
                >
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-4 rounded-2xl bg-yellow-500/10 text-yellow-500">
                      <Lightbulb className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">
                      {new Date(insight.published_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-3xl font-black mb-4 tracking-tight group-hover:text-primary transition-colors">
                    {insight.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed font-medium mb-8">
                    {insight.content}
                  </p>
                  <Link 
                    to={insight.link_url || '#'}
                    className="inline-flex items-center gap-2 text-primary font-black uppercase tracking-widest text-xs hover:translate-x-2 transition-all"
                  >
                    Read Deep Dive <ArrowRight className="w-4 h-4" />
                  </Link>
                </motion.div>
              ))}
              {insights.length === 0 && (
                <div className="col-span-full text-center py-20 glass rounded-[3rem]">
                  <p className="text-muted-foreground font-bold">No insights published yet. Check back soon!</p>
                </div>
              )}
            </div>
          )}

          {/* Reviews Section */}
          {activeTab === 'reviews' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              {reviews.map((review) => (
                <motion.div
                  key={review.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="glass p-8 rounded-[2.5rem] flex flex-col md:flex-row gap-8 items-start"
                >
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black text-2xl">
                      {review.profile?.full_name?.[0] || review.user?.[0]}
                    </div>
                    <div>
                      <p className="font-black text-lg">{review.profile?.full_name || review.user}</p>
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i < review.rating ? 'fill-yellow-500 text-yellow-500' : 'text-white/10'}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex-grow">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-black text-primary uppercase tracking-widest">Reviewed:</span>
                      <span className="text-xs font-bold">{review.product?.title || review.book}</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed font-medium italic">
                      "{review.comment}"
                    </p>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mt-4">
                      {review.created_at ? new Date(review.created_at).toLocaleDateString() : review.date}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Events Section */}
          {activeTab === 'events' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {events.map((event) => (
                <motion.div
                  key={event.id}
                  whileHover={{ y: -5 }}
                  className="glass overflow-hidden rounded-[3rem] group"
                >
                  <div className="aspect-video relative overflow-hidden">
                    <img 
                      src={event.image_url || 'https://images.unsplash.com/photo-1512820790803-83ca734da794?q=80&w=800'} 
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute top-6 left-6">
                      <span className="glass px-3 py-1 rounded-full text-[10px] font-black text-primary uppercase tracking-widest">
                        {event.metadata?.event_type || 'Gathering'}
                      </span>
                    </div>
                  </div>
                  <div className="p-8">
                    <h3 className="text-2xl font-black mb-4 tracking-tight group-hover:text-primary transition-colors">
                      {event.title}
                    </h3>
                    <div className="space-y-3 mb-8">
                      <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
                        <Calendar className="w-4 h-4 text-primary" />
                        <span>{new Date(event.published_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
                        <Clock className="w-4 h-4 text-primary" />
                        <span>{event.metadata?.time || '14:00 PM'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
                        <MapPin className="w-4 h-4 text-primary" />
                        <span>{event.metadata?.location || 'Virtual / ReadMart Hub'}</span>
                      </div>
                    </div>
                    <button className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-lg shadow-primary/20">
                      RSVP NOW
                    </button>
                  </div>
                </motion.div>
              ))}
              {events.length === 0 && (
                <div className="col-span-full text-center py-20 glass rounded-[3rem]">
                  <p className="text-muted-foreground font-bold">No upcoming events. Stay tuned!</p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
