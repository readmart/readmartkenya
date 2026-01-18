import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Clock, Ticket, Share2, Loader2 } from 'lucide-react';
import { getEvents, type CMSContent } from '@/api/community';
import { toast } from 'sonner';
import { PaymentWall } from '@/components/membership/PaymentWall';

export default function Events() {
  const [events, setEvents] = useState<CMSContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const data = await getEvents();
      setEvents(data);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    } finally {
      setIsLoading(false);
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
      <header className="mb-16">
        <div className="flex justify-between items-end gap-6 flex-wrap">
          <div>
            <h1 className="text-6xl font-black uppercase tracking-tighter mb-4">Upcoming Events</h1>
            <p className="text-xl text-muted-foreground font-medium max-w-2xl">
              From exclusive book signings to creative workshops, join us in celebrating art and literature.
            </p>
          </div>
          <div className="flex gap-4">
            <button className="glass px-6 py-3 rounded-2xl font-bold hover:bg-white/10 transition-all">Past Events</button>
            <button className="bg-primary text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20">Submit Event</button>
          </div>
        </div>
      </header>

      <PaymentWall>
        <div className="space-y-12">
          {events.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-[3rem] overflow-hidden flex flex-col lg:flex-row group hover:border-primary/20 transition-all"
            >
              <div className="lg:w-1/3 aspect-[16/10] lg:aspect-auto relative overflow-hidden">
                <img 
                  src={event.image_url || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800'} 
                  alt={event.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-6 left-6 glass px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-primary">
                  {event.metadata?.event_type || 'Gathering'}
                </div>
              </div>
              
              <div className="flex-1 p-8 lg:p-12 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-3xl font-black tracking-tight group-hover:text-primary transition-colors">{event.title}</h3>
                    <button className="p-3 glass rounded-xl hover:bg-white/10 transition-all">
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-6 mb-8">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-primary/10 text-primary">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Date</p>
                        <p className="font-bold">{new Date(event.published_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-secondary/10 text-secondary">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Time</p>
                        <p className="font-bold">{event.metadata?.time || '14:00 PM'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-green-500/10 text-green-500">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Location</p>
                        <p className="font-bold">{event.metadata?.location || 'ReadMart Hub'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-yellow-500/10 text-yellow-500">
                        <Ticket className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Entry</p>
                        <p className="font-bold">{event.metadata?.price || 'Free'}</p>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-muted-foreground leading-relaxed font-medium mb-8">
                    {event.content}
                  </p>
                </div>
                
                <button className="w-full sm:w-fit bg-primary text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 transition-all shadow-xl shadow-primary/20">
                  Book Your Spot
                </button>
              </div>
            </motion.div>
          ))}
          {events.length === 0 && (
            <div className="text-center py-20 glass rounded-[3rem]">
              <p className="text-muted-foreground font-bold text-xl">No upcoming events scheduled at the moment.</p>
            </div>
          )}
        </div>
      </PaymentWall>
    </div>
  );
}
