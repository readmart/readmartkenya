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
  getRecentReviews,
  getUserRSVPs,
  rsvpToEvent,
  getClubDiscussions,
  type CMSContent,
  type BookClub,
  type BookClubMembership,
  type Review,
  type EventRSVP,
  type ClubDiscussion
} from '@/api/community';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { PaymentWall } from '@/components/membership/PaymentWall';

type Tab = 'communities' | 'insights' | 'reviews' | 'events';

export default function BookClub() {
  const [activeTab, setActiveTab] = useState<Tab>('communities');
  const [clubs, setClubs] = useState<BookClub[]>([]);
  const [insights, setInsights] = useState<CMSContent[]>([]);
  const [events, setEvents] = useState<CMSContent[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [membership, setMembership] = useState<BookClubMembership | null>(null);
  const [userRSVPs, setUserRSVPs] = useState<EventRSVP[]>([]);
  const [clubDiscussions, setClubDiscussions] = useState<ClubDiscussion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState<string | null>(null);
  const [isRSVPing, setIsRSVPing] = useState<string | null>(null);
  const { user } = useAuth();
  
  // Safe use of currency context
  let formatPrice = (amount: number) => `KES ${amount}`;
  try {
    const currencyContext = useCurrency();
    if (currencyContext) {
      formatPrice = currencyContext.formatPrice;
    }
  } catch (e) {
    console.warn('BookClub: CurrencyContext not found, using default formatter');
  }

  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (membership?.club_id) {
      fetchDiscussions(membership.club_id);
    }
  }, [membership]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [clubsData, insightsData, eventsData, reviewsData, membershipData, rsvpsData] = await Promise.all([
        getAvailableBookClubs(),
        getInsights(),
        getEvents(),
        getRecentReviews(),
        getUserMembership(),
        getUserRSVPs()
      ]);

      setClubs(clubsData);
      setInsights(insightsData);
      setEvents(eventsData);
      setReviews(reviewsData);
      setMembership(membershipData);
      setUserRSVPs(rsvpsData);
    } catch (error) {
      console.error('Error fetching book club data:', error);
      toast.error('Failed to load community data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDiscussions = async (clubId: string) => {
    try {
      const discussions = await getClubDiscussions(clubId);
      setClubDiscussions(discussions);
    } catch (error) {
      console.error('Error fetching discussions:', error);
    }
  };

  const handleRSVP = async (eventId: string) => {
    if (!user) {
      toast.error('Please login to RSVP');
      return;
    }

    setIsRSVPing(eventId);
    try {
      await rsvpToEvent(eventId);
      toast.success('RSVP confirmed!');
      const rsvps = await getUserRSVPs();
      setUserRSVPs(rsvps);
    } catch (error) {
      toast.error('Failed to RSVP');
    } finally {
      setIsRSVPing(null);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to join club';
      toast.error(message);
    } finally {
      setIsJoining(null);
    }
  };

  const handleLeaveClub = async (clubId: string) => {
    try {
      await leaveBookClub(clubId);
      toast.success('You have left the club');
      setMembership(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to leave club';
      toast.error(message);
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

      <PaymentWall clubId={membership?.club_id}>
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
            <div className="space-y-12">
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
                    {club.name}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-6 font-medium">
                    {club.description}
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
                    <div className="flex items-center gap-3 text-sm font-bold text-primary bg-primary/5 px-4 py-2 rounded-xl">
                      <span>{club.membership_price > 0 ? formatPrice(club.membership_price) : 'Free to Join'}</span>
                    </div>
                  </div>
                  
                    {membership?.club_id === club.id ? (
                      <div className="space-y-4">
                        <button 
                          onClick={() => handleLeaveClub(club.id)}
                          className="w-full glass text-red-500 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-500 hover:text-white transition-all"
                        >
                          Leave Club
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => {
                          if (club.membership_price > 0) {
                            // Redirect to a membership/payment page for this specific club
                            navigate(`/membership?club=${club.id}`);
                          } else {
                            handleJoinClub(club.id);
                          }
                        }}
                        disabled={isJoining === club.id || membership !== null}
                        className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 ${
                          membership !== null 
                            ? 'bg-muted text-muted-foreground cursor-not-allowed'
                            : 'bg-white text-black hover:bg-primary hover:text-white shadow-lg'
                        }`}
                      >
                        {isJoining === club.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : membership !== null ? (
                          'One-Club Policy Active'
                        ) : club.membership_price > 0 ? (
                          <>Unlock Membership <ArrowRight className="w-4 h-4" /></>
                        ) : (
                          <>Join This Club <ArrowRight className="w-4 h-4" /></>
                        )}
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Member-Only Discussions Section */}
              {membership && (
                <motion.div 
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-20 pt-20 border-t border-slate-100"
                >
                  <div className="flex items-center justify-between mb-12">
                    <div>
                      <span className="text-primary font-black uppercase tracking-widest text-xs mb-2 block">Member Exclusive</span>
                      <h2 className="text-4xl font-black tracking-tighter uppercase">Club <span className="text-primary">Discussions</span></h2>
                    </div>
                    <div className="hidden md:flex items-center gap-3 glass px-6 py-3 rounded-2xl">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-widest">{clubDiscussions.length} Active Threads</span>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-3 gap-8">
                    {clubDiscussions.map((discussion) => (
                      <motion.div
                        key={discussion.id}
                        whileHover={{ y: -5 }}
                        className="glass p-8 rounded-[3rem] border-primary/10 relative overflow-hidden"
                      >
                        {discussion.is_pinned && (
                          <div className="absolute top-6 right-6 text-primary">
                            <Star className="w-5 h-5 fill-current" />
                          </div>
                        )}
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border-2 border-white shadow-sm">
                            {discussion.author?.avatar_url ? (
                              <img src={discussion.author.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-xs">
                                {discussion.author?.full_name?.[0] || 'A'}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-tight">{discussion.author?.full_name || 'Anonymous'}</p>
                            <p className="text-[10px] text-muted-foreground font-bold">{new Date(discussion.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <h4 className="text-xl font-black mb-3 tracking-tight leading-tight">{discussion.title}</h4>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-6 line-clamp-3 font-medium">
                          {discussion.content}
                        </p>
                        <button className="text-primary font-black uppercase tracking-widest text-[10px] flex items-center gap-2 hover:translate-x-2 transition-all">
                          Read Discussion <ArrowRight className="w-3 h-3" />
                        </button>
                      </motion.div>
                    ))}
                    {clubDiscussions.length === 0 && (
                      <div className="col-span-full py-20 text-center glass rounded-[3rem] border-dashed border-2 border-slate-100">
                        <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                        <p className="text-slate-400 font-black uppercase tracking-widest text-sm">No discussions yet in this club</p>
                        <p className="text-xs text-slate-400 mt-2">Check back later for updates from the founder!</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
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
                    <button 
                      onClick={() => handleRSVP(event.id)}
                      disabled={isRSVPing === event.id || userRSVPs.some(r => r.event_id === event.id)}
                      className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg ${
                        userRSVPs.some(r => r.event_id === event.id)
                          ? 'bg-green-500 text-white cursor-default'
                          : 'bg-primary text-white hover:scale-105 shadow-primary/20'
                      }`}
                    >
                      {isRSVPing === event.id ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : userRSVPs.some(r => r.event_id === event.id) ? (
                        'RSVP CONFIRMED'
                      ) : (
                        'RSVP NOW'
                      )}
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
      </PaymentWall>
    </div>
  );
}
