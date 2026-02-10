import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { 
  Handshake, Plus, Search, Filter, 
  Edit2, Trash2, Shield, Star, 
  List, Save, X, Loader2
} from 'lucide-react';
import { 
  getPartnershipTiers, 
  getPartners, 
  createPartnershipTier, 
  updatePartnershipTier, 
  deletePartnershipTier,
  managePartner 
} from '@/api/partnerships';
import { toast } from 'sonner';

export default function FounderPartnerships() {
  const [activeTab, setActiveTab] = useState<'partners' | 'tiers'>('partners');
  const [partners, setPartners] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [isTierModalOpen, setIsTierModalOpen] = useState(false);
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<any>(null);
  const [editingPartner, setEditingPartner] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [partnersData, tiersData] = await Promise.all([
        getPartners(),
        getPartnershipTiers()
      ]);
      setPartners(partnersData);
      setTiers(tiersData);
    } catch (error) {
      toast.error('Failed to load partnerships data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTierSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const tierData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      color_code: formData.get('color_code') as string,
      display_order: parseInt(formData.get('display_order') as string),
      benefits: (formData.get('benefits') as string).split('\n').filter(b => b.trim()),
      is_active: formData.get('is_active') === 'on'
    };

    try {
      if (editingTier) {
        await updatePartnershipTier(editingTier.id, tierData);
        toast.success('Tier updated successfully');
      } else {
        await createPartnershipTier(tierData as any);
        toast.success('Tier created successfully');
      }
      setIsTierModalOpen(false);
      loadData();
    } catch (error) {
      toast.error('Failed to save tier');
    }
  };

  const handlePartnerSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const partnerData = {
      company_name: formData.get('company_name') as string,
      tier_id: formData.get('tier_id') as string || undefined,
      description: formData.get('description') as string,
      website_url: formData.get('website_url') as string,
      logo_url: formData.get('logo_url') as string,
      contact_email: formData.get('contact_email') as string,
      status: formData.get('status') as any,
      is_featured: formData.get('is_featured') === 'on'
    };

    try {
      await managePartner(editingPartner?.id || null, partnerData as any);
      toast.success('Partner profile saved successfully');
      setIsPartnerModalOpen(false);
      loadData();
    } catch (error) {
      toast.error('Failed to save partner profile');
    }
  };

  const handleDeleteTier = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tier? This might affect existing partners.')) return;
    try {
      await deletePartnershipTier(id);
      toast.success('Tier deleted successfully');
      loadData();
    } catch (error) {
      toast.error('Failed to delete tier');
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black uppercase tracking-tight mb-2">Partnership Manager</h1>
          <p className="text-muted-foreground font-medium">Manage your global ecosystem and collaboration tiers.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => {
              setEditingTier(null);
              setIsTierModalOpen(true);
            }}
            className="px-6 py-3 glass border-white/10 rounded-2xl font-bold flex items-center gap-2 hover:bg-white/5 transition-all"
          >
            <Shield className="w-4 h-4" />
            New Tier
          </button>
          <button 
            onClick={() => {
              setEditingPartner(null);
              setIsPartnerModalOpen(true);
            }}
            className="px-6 py-3 bg-primary text-white rounded-2xl font-bold flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Add Partner
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex p-1 glass rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('partners')}
          className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'partners' ? 'bg-primary text-white shadow-lg' : 'hover:bg-white/5'
          }`}
        >
          Partners
        </button>
        <button 
          onClick={() => setActiveTab('tiers')}
          className={`px-8 py-3 rounded-xl font-bold text-sm transition-all ${
            activeTab === 'tiers' ? 'bg-primary text-white shadow-lg' : 'hover:bg-white/5'
          }`}
        >
          Tiers
        </button>
      </div>

      {isLoading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground font-bold">Synchronizing partnership data...</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {activeTab === 'partners' ? (
            <motion.div 
              key="partners"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass rounded-[2.5rem] overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex flex-col md:flex-row justify-between gap-4 bg-white/5">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input 
                    type="text" 
                    placeholder="Search partners..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 glass rounded-xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                  />
                </div>
                <div className="flex gap-3">
                  <button className="p-3 glass rounded-xl hover:bg-white/10 transition-all">
                    <Filter className="w-5 h-5" />
                  </button>
                  <button className="p-3 glass rounded-xl hover:bg-white/10 transition-all">
                    <List className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <th className="px-8 py-6">Partner</th>
                      <th className="px-8 py-6">Tier</th>
                      <th className="px-8 py-6">Category</th>
                      <th className="px-8 py-6">Status</th>
                      <th className="px-8 py-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {partners.map((partner) => (
                      <tr key={partner.id} className="hover:bg-white/5 transition-all group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 glass rounded-xl flex items-center justify-center p-2">
                              {partner.logo_url ? (
                                <img src={partner.logo_url} alt="" className="max-w-full max-h-full object-contain" />
                              ) : (
                                <Handshake className="w-6 h-6 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold flex items-center gap-2">
                                {partner.company_name}
                                {partner.is_featured && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                              </p>
                              <p className="text-xs text-muted-foreground">{partner.contact_email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          {partner.tier ? (
                            <span 
                              className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border"
                              style={{ 
                                color: partner.tier.color_code, 
                                borderColor: `${partner.tier.color_code}40`,
                                backgroundColor: `${partner.tier.color_code}10`
                              }}
                            >
                              {partner.tier.name}
                            </span>
                          ) : (
                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Untiered</span>
                          )}
                        </td>
                        <td className="px-8 py-6">
                          <span className="text-sm font-bold opacity-60">{partner.category || 'General'}</span>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              partner.status === 'active' ? 'bg-green-500 animate-pulse' : 
                              partner.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                            }`} />
                            <span className="text-xs font-black uppercase tracking-widest">{partner.status}</span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                setEditingPartner(partner);
                                setIsPartnerModalOpen(true);
                              }}
                              className="p-2 glass rounded-lg hover:text-primary transition-all"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button className="p-2 glass rounded-lg hover:text-red-500 transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="tiers"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {tiers.map((tier) => (
                <div 
                  key={tier.id} 
                  className="glass p-8 rounded-[2.5rem] border-white/5 space-y-6 relative group"
                >
                  <div className="flex justify-between items-start">
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ backgroundColor: `${tier.color_code}20`, color: tier.color_code }}
                    >
                      <Shield className="w-6 h-6" />
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setEditingTier(tier);
                          setIsTierModalOpen(true);
                        }}
                        className="p-2 glass rounded-xl hover:text-primary transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTier(tier.id)}
                        className="p-2 glass rounded-xl hover:text-red-500 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-2xl font-black mb-2" style={{ color: tier.color_code }}>{tier.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{tier.description}</p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Key Benefits</p>
                    <div className="flex flex-wrap gap-2">
                      {(tier.benefits || []).map((benefit: string, idx: number) => (
                        <span key={idx} className="text-[10px] font-bold px-2 py-1 glass rounded-lg border-white/5">
                          {benefit}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5 flex justify-between items-center">
                    <span className="text-xs font-black uppercase tracking-widest opacity-40">Order: {tier.display_order}</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${tier.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest">{tier.is_active ? 'Active' : 'Disabled'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Tier Modal */}
      <AnimatePresence>
        {isTierModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass p-8 rounded-[3rem] w-full max-w-lg border-white/10"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black">{editingTier ? 'Edit Tier' : 'Create New Tier'}</h3>
                <button onClick={() => setIsTierModalOpen(false)} className="p-2 glass rounded-full hover:bg-white/10 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleTierSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Tier Name</label>
                    <input name="name" defaultValue={editingTier?.name} required className="w-full px-6 py-4 glass rounded-2xl outline-none border-white/5 focus:border-primary/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Color (Hex)</label>
                    <input name="color_code" defaultValue={editingTier?.color_code || '#808080'} required className="w-full px-6 py-4 glass rounded-2xl outline-none border-white/5 focus:border-primary/50" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Description</label>
                  <textarea name="description" defaultValue={editingTier?.description} rows={3} className="w-full px-6 py-4 glass rounded-2xl outline-none border-white/5 focus:border-primary/50 resize-none" />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Benefits (One per line)</label>
                  <textarea name="benefits" defaultValue={editingTier?.benefits?.join('\n')} rows={4} className="w-full px-6 py-4 glass rounded-2xl outline-none border-white/5 focus:border-primary/50 resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Display Order</label>
                    <input name="display_order" type="number" defaultValue={editingTier?.display_order || 0} className="w-full px-6 py-4 glass rounded-2xl outline-none border-white/5 focus:border-primary/50" />
                  </div>
                  <div className="flex items-center gap-4 pt-8 pl-4">
                    <input type="checkbox" name="is_active" id="is_active" defaultChecked={editingTier?.is_active ?? true} className="w-5 h-5 accent-primary" />
                    <label htmlFor="is_active" className="text-sm font-bold">Is Active</label>
                  </div>
                </div>

                <button type="submit" className="w-full py-5 bg-primary text-white rounded-2xl font-black hover:scale-[1.02] transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                  <Save className="w-5 h-5" />
                  {editingTier ? 'Update Tier' : 'Create Tier'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Partner Modal */}
      <AnimatePresence>
        {isPartnerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass p-8 rounded-[3rem] w-full max-w-2xl border-white/10 my-8"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black">{editingPartner ? 'Edit Partner' : 'Add New Partner'}</h3>
                <button onClick={() => setIsPartnerModalOpen(false)} className="p-2 glass rounded-full hover:bg-white/10 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handlePartnerSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Company Name</label>
                    <input name="company_name" defaultValue={editingPartner?.company_name} required className="w-full px-6 py-4 glass rounded-2xl outline-none border-white/5 focus:border-primary/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Partnership Tier</label>
                    <select name="tier_id" defaultValue={editingPartner?.tier_id || ''} className="w-full px-6 py-4 glass rounded-2xl outline-none border-white/5 focus:border-primary/50 appearance-none">
                      <option value="">Select Tier</option>
                      {tiers.map(tier => (
                        <option key={tier.id} value={tier.id}>{tier.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Website URL</label>
                    <input name="website_url" type="url" defaultValue={editingPartner?.website_url} className="w-full px-6 py-4 glass rounded-2xl outline-none border-white/5 focus:border-primary/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Logo URL</label>
                    <input name="logo_url" type="url" defaultValue={editingPartner?.logo_url} className="w-full px-6 py-4 glass rounded-2xl outline-none border-white/5 focus:border-primary/50" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Description</label>
                  <textarea name="description" defaultValue={editingPartner?.description} rows={3} className="w-full px-6 py-4 glass rounded-2xl outline-none border-white/5 focus:border-primary/50 resize-none" />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Contact Email</label>
                    <input name="contact_email" type="email" defaultValue={editingPartner?.contact_email} className="w-full px-6 py-4 glass rounded-2xl outline-none border-white/5 focus:border-primary/50" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Status</label>
                    <select name="status" defaultValue={editingPartner?.status || 'active'} className="w-full px-6 py-4 glass rounded-2xl outline-none border-white/5 focus:border-primary/50 appearance-none">
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4 pl-4">
                  <input type="checkbox" name="is_featured" id="is_featured" defaultChecked={editingPartner?.is_featured} className="w-5 h-5 accent-primary" />
                  <label htmlFor="is_featured" className="text-sm font-bold">Featured Partner</label>
                </div>

                <button type="submit" className="w-full py-5 bg-primary text-white rounded-2xl font-black hover:scale-[1.02] transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                  <Save className="w-5 h-5" />
                  {editingPartner ? 'Update Partner' : 'Create Partner'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
