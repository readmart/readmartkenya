import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, 
  Users, 
  Globe, 
  Lock, 
  ShieldCheck,
  Calendar,
  Monitor,
  MapPin,
  BookOpen,
  ArrowRight,
  Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { createBookClub } from '@/api/bookclub';

const GENRES = [
  'Fiction', 'Non-Fiction', 'Mystery', 'Sci-Fi', 'Fantasy', 
  'Biography', 'History', 'Self-Help', 'Business', 'Poetry', 'Classic'
];

const FREQUENCIES = [
  { id: 'weekly', label: 'Weekly', desc: 'Meet once a week' },
  { id: 'biweekly', label: 'Bi-Weekly', desc: 'Meet every two weeks' },
  { id: 'monthly', label: 'Monthly', desc: 'Meet once a month' },
];

const FORMATS = [
  { id: 'online', label: 'Online', icon: Monitor, desc: 'Via Zoom, Discord, etc.' },
  { id: 'in-person', label: 'In-Person', icon: MapPin, desc: 'Local coffee shops, homes' },
  { id: 'hybrid', label: 'Hybrid', icon: Users, desc: 'Mix of both' },
];

const CreateClub: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    genre: '',
    is_public: true,
    require_approval: false,
    meeting_frequency: 'monthly',
    meeting_format: 'online',
    meeting_platform: '',
  });

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    if (!formData.name) return toast.error('Please enter a club name');
    
    try {
      setLoading(true);
      const club = await createBookClub(formData);
      toast.success('Book club created successfully!');
      navigate(`/book-club-hub/${club.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create club');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-3xl mx-auto px-4 pt-12">
        <button 
          onClick={() => navigate('/book-club-hub')}
          className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors mb-8"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Hub
        </button>

        {/* Progress Bar */}
        <div className="flex gap-2 mb-12">
          {[1, 2, 3].map((i) => (
            <div 
              key={i} 
              className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                step >= i ? 'bg-primary' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border p-8 md:p-12">
          {step === 1 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div className="text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900">Basic Information</h2>
                <p className="text-gray-500">Let's start with the essentials of your club.</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Club Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. The Midnight Readers"
                    className="w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <textarea 
                    placeholder="Tell potential members what your club is about..."
                    rows={4}
                    className="w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Primary Genre</label>
                  <div className="flex flex-wrap gap-2">
                    {GENRES.map((genre) => (
                      <button
                        key={genre}
                        onClick={() => setFormData({ ...formData, genre })}
                        className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                          formData.genre === genre 
                            ? 'bg-primary border-primary text-white' 
                            : 'bg-white border-gray-200 text-gray-600 hover:border-primary'
                        }`}
                      >
                        {genre}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div className="text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900">Privacy & Access</h2>
                <p className="text-gray-500">Control who can see and join your club.</p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => setFormData({ ...formData, is_public: true })}
                  className={`w-full p-6 rounded-2xl border-2 transition-all flex items-start gap-4 text-left ${
                    formData.is_public ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${formData.is_public ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <Globe className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Public Club</h4>
                    <p className="text-sm text-gray-500">Anyone can find and see this club in the hub.</p>
                  </div>
                  {formData.is_public && <Check className="w-6 h-6 text-primary ml-auto" />}
                </button>

                <button
                  onClick={() => setFormData({ ...formData, is_public: false })}
                  className={`w-full p-6 rounded-2xl border-2 transition-all flex items-start gap-4 text-left ${
                    !formData.is_public ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className={`p-3 rounded-xl ${!formData.is_public ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Private Club</h4>
                    <p className="text-sm text-gray-500">Only invited members or those with a link can find this club.</p>
                  </div>
                  {!formData.is_public && <Check className="w-6 h-6 text-primary ml-auto" />}
                </button>

                <div className="pt-6 border-t mt-6 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-gray-900">Require Approval</h4>
                    <p className="text-sm text-gray-500">Members must be approved by an admin before joining.</p>
                  </div>
                  <button
                    onClick={() => setFormData({ ...formData, require_approval: !formData.require_approval })}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      formData.require_approval ? 'bg-primary' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                      formData.require_approval ? 'right-1' : 'left-1'
                    }`} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div className="text-center">
                <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900">Meeting Schedule</h2>
                <p className="text-gray-500">When and where will your club meet?</p>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-4">Frequency</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {FREQUENCIES.map((freq) => (
                      <button
                        key={freq.id}
                        onClick={() => setFormData({ ...formData, meeting_frequency: freq.id })}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                          formData.meeting_frequency === freq.id ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <h5 className="font-bold text-gray-900">{freq.label}</h5>
                        <p className="text-xs text-gray-500">{freq.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-4">Format</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {FORMATS.map((format) => (
                      <button
                        key={format.id}
                        onClick={() => setFormData({ ...formData, meeting_format: format.id })}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                          formData.meeting_format === format.id ? 'border-primary bg-primary/5' : 'border-gray-100 hover:border-gray-200'
                        }`}
                      >
                        <format.icon className={`w-6 h-6 mb-2 ${formData.meeting_format === format.id ? 'text-primary' : 'text-gray-400'}`} />
                        <h5 className="font-bold text-gray-900">{format.label}</h5>
                        <p className="text-xs text-gray-500">{format.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {formData.meeting_format === 'online' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Preferred Platform</label>
                    <input 
                      type="text"
                      placeholder="e.g. Zoom, Google Meet, Discord"
                      className="w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      value={formData.meeting_platform}
                      onChange={(e) => setFormData({ ...formData, meeting_platform: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-4 mt-12 pt-8 border-t">
            {step > 1 && (
              <button 
                onClick={handleBack}
                disabled={loading}
                className="flex-1 px-6 py-3 rounded-xl font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button 
                onClick={handleNext}
                className="flex-[2] bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                Next Step
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button 
                onClick={handleSubmit}
                disabled={loading}
                className="flex-[2] bg-primary text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating Club...
                  </>
                ) : (
                  <>
                    Complete & Launch
                    <Check className="w-5 h-5" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateClub;
