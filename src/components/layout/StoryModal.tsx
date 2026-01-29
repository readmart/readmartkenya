import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Heart, Zap, Sparkles, MapPin, Coffee, Crosshair, Users } from 'lucide-react';

interface StoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const StoryModal = ({ isOpen, onClose }: StoryModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] cursor-zoom-out"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-4 md:inset-10 lg:inset-20 z-[101] flex items-center justify-center pointer-events-none"
          >
            <div className="bg-[#0A0A0A] w-full max-w-5xl h-full max-h-[850px] rounded-[2rem] md:rounded-[3.5rem] border border-white/10 overflow-hidden flex flex-col pointer-events-auto relative shadow-2xl shadow-primary/20">
              
              {/* Close Button */}
              <button 
                onClick={onClose}
                className="absolute top-6 right-6 md:top-10 md:right-10 p-3 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all z-10 border border-white/10 group"
              >
                <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
              </button>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-8 md:p-16 lg:p-20">
                <div className="max-w-3xl mx-auto space-y-16">
                  
                  {/* Header */}
                  <div className="space-y-6 text-center">
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-widest"
                    >
                      <Sparkles className="w-3 h-3" />
                      The ReadMart Story
                    </motion.div>
                    <motion.h2 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight"
                    >
                      Stories meet people, <br/>
                      <span className="text-primary">everywhere life happens.</span>
                    </motion.h2>
                  </div>

                  {/* Main Story Content */}
                  <div className="space-y-8 text-lg md:text-xl text-white/80 font-medium leading-relaxed">
                    <motion.p 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      READMART Bookstore began with a simple belief: <br/>
                      <span className="text-white font-bold italic">Stories are meant to meet people — everywhere life happens.</span>
                    </motion.p>

                    <motion.p 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                    >
                      We looked around and saw something missing. Readers searching for comfort. Dreamers looking for inspiration. People craving connection in a fast, restless world. Books had the power to meet those needs, but only if they could reach the people who needed them most.
                    </motion.p>

                    <div className="py-8 border-y border-white/5 space-y-6">
                      <motion.p 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 }}
                        className="text-primary font-bold flex items-center gap-3"
                      >
                        <Zap className="w-6 h-6" />
                        So we asked ourselves:
                      </motion.p>
                      <ul className="space-y-4 pl-9 list-none">
                        {[
                          "What if books could travel?",
                          "What if stories could find you—not just at home, but in cafés, hospitals, offices, campuses, and every space in between?"
                        ].map((q, i) => (
                          <motion.li 
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.7 + (i * 0.1) }}
                            className="text-2xl md:text-3xl font-black text-white tracking-tight italic opacity-90"
                          >
                            "{q}"
                          </motion.li>
                        ))}
                      </ul>
                    </div>

                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.9 }}
                      className="space-y-6"
                    >
                      <p>From that question, our mission was born:</p>
                      <div className="p-8 glass rounded-3xl border-primary/20 bg-primary/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                          <Crosshair className="w-24 h-24 text-primary" />
                        </div>
                        <p className="text-2xl md:text-3xl font-black text-white leading-tight relative z-10">
                          To reimagine how books meet people through innovation, community, personalized services, and unforgettable literary experiences.
                        </p>
                      </div>
                    </motion.div>

                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.0 }}
                      className="space-y-6 pt-8"
                    >
                      <p>
                        READMART Bookstore is more than a bookstore. <br/>
                        It is a <span className="text-primary font-bold underline decoration-2 underline-offset-4">movement</span> to make reading a living, breathing part of daily life. A movement to build a vibrant and inclusive reading culture across Kenya and beyond.
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { icon: MapPin, text: "Doorstep deliveries" },
                          { icon: Coffee, text: "Curated reading corners" },
                          { icon: Users, text: "Community events" },
                          { icon: BookOpen, text: "Thoughtful book experiences" }
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
                            <item.icon className="w-5 h-5 text-primary/60" />
                            <span className="text-sm font-bold text-white/90">{item.text}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>

                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.1 }}
                      className="space-y-8"
                    >
                      <p>Because we believe books should be companions:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {[
                          "Present in your quiet nights and joyful mornings.",
                          "With you in waiting rooms and long commutes.",
                          "Close during seasons of healing, celebration, growth, and transformation."
                        ].map((text, i) => (
                          <div key={i} className={`p-6 rounded-3xl border border-white/5 ${i === 2 ? 'md:col-span-2 bg-secondary/5 border-secondary/10' : 'bg-white/5'}`}>
                            <p className="text-base font-medium leading-relaxed italic text-white/70">
                              {text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </motion.div>

                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.2 }}
                      className="space-y-8 py-12"
                    >
                      <h4 className="text-sm font-black uppercase tracking-[0.2em] text-primary/60 text-center">Every book is a reminder</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {['Heal', 'Connect', 'Inspire', 'Change'].map((word, i) => (
                          <div key={i} className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                              <Heart className="w-6 h-6 fill-current" />
                            </div>
                            <span className="text-xs font-black uppercase tracking-widest text-white/60">{word}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>

                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.3 }}
                      className="text-center space-y-4 pt-12"
                    >
                      <p className="text-2xl md:text-3xl font-black text-white italic">
                        "READMART Bookstore is still writing its story, page by page. And the most beautiful part?"
                      </p>
                      <div className="pt-8">
                        <button 
                          onClick={onClose}
                          className="px-10 py-5 rounded-full bg-primary text-black font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20"
                        >
                          You are part of it.
                        </button>
                      </div>
                    </motion.div>

                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default StoryModal;
