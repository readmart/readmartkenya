import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, Download, Upload, CheckCircle, 
  Clock, AlertCircle, Loader2, FileCheck,
  Eye, X, Info, ShieldCheck
} from 'lucide-react';
import { getUserAgreements, submitSignedAgreement } from '@/api/dashboards';
import { uploadAgreementFile } from '@/api/storage';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface AgreementsSectionProps {
  userId: string;
  type: 'author' | 'partner';
}

export default function AgreementsSection({ userId, type }: AgreementsSectionProps) {
  const [agreements, setAgreements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [selectedAgreement, setSelectedAgreement] = useState<any>(null);
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchAgreements();
  }, [userId]);

  useEffect(() => {
    if (selectedAgreement) {
      generatePreviewUrl(selectedAgreement.template_url);
    } else {
      setPreviewUrl(null);
    }
  }, [selectedAgreement]);

  const generatePreviewUrl = async (path: string) => {
     if (!path) return;
     try {
       const bucket = path.includes('signed') ? 'signed_agreements' : 'agreements';
       const { data, error } = await supabase.storage
         .from(bucket)
         .createSignedUrl(path, 3600); // 1 hour

       if (error) throw error;
       setPreviewUrl(data.signedUrl);
     } catch (error) {
       console.error('Failed to generate preview URL:', error);
     }
   };

  const fetchAgreements = async () => {
    try {
      const data = await getUserAgreements(userId);
      setAgreements(data);
    } catch (error) {
      console.error('Failed to fetch agreements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewFile = async (path: string) => {
    if (!path) {
      toast.error('No document file found');
      return;
    }
    
    // Determine bucket based on path or context
    const bucket = path.includes('signed') ? 'signed_agreements' : 'agreements';
    
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 600); // 10 minutes

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('View file error:', error);
      toast.error('Could not generate document link');
    }
  };

  const handleUpload = async (agreementId: string, file: File) => {
    if (!hasReadTerms) {
      toast.error('Please read and confirm the agreement terms first');
      return;
    }

    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed');
      return;
    }

    setIsUploading(agreementId);
    try {
      // Use the specific agreement ID in the path to avoid collisions if multiple exist
      const fileUrl = await uploadAgreementFile(file, `${userId}_${agreementId}`, 'signed_agreements');
      await submitSignedAgreement(agreementId, fileUrl);
      toast.success('Agreement signed and account activated! Welcome aboard.');
      setSelectedAgreement(null);
      setHasReadTerms(false);
      fetchAgreements();
      
      // Refresh the page after a short delay to update dashboard layout/roles
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload agreement');
    } finally {
      setIsUploading(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <FileCheck className="text-primary w-6 h-6" />
          Collaboration Agreements
        </h3>
        <span className="text-xs text-muted-foreground uppercase tracking-widest font-bold">
          {type} Protocol
        </span>
      </div>

      <div className="grid gap-4">
        {agreements.map((agreement) => (
          <motion.div
            key={agreement.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 group hover:bg-white/5 transition-all"
          >
            <div className="flex items-start gap-4 flex-1">
              <div className={`p-3 rounded-xl ${
                agreement.status === 'approved' ? 'bg-green-500/10 text-green-500' :
                agreement.status === 'signed' ? 'bg-blue-500/10 text-blue-500' :
                agreement.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                'bg-orange-500/10 text-orange-500'
              }`}>
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-lg">{agreement.title}</h4>
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                  {agreement.description || 'Please review and sign the terms for this collaboration.'}
                </p>
                
                <div className="flex items-center gap-4 mt-3">
                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md flex items-center gap-1 ${
                    agreement.status === 'approved' ? 'bg-green-500/10 text-green-500' :
                    agreement.status === 'signed' ? 'bg-blue-500/10 text-blue-500' :
                    agreement.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                    'bg-orange-500/10 text-orange-500'
                  }`}>
                    {agreement.status === 'approved' && <CheckCircle className="w-3 h-3" />}
                    {agreement.status === 'signed' && <Clock className="w-3 h-3" />}
                    {agreement.status === 'pending' && <Clock className="w-3 h-3" />}
                    {agreement.status === 'rejected' && <AlertCircle className="w-3 h-3" />}
                    {agreement.status}
                  </span>
                  
                  {agreement.signed_at && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Signed: {new Date(agreement.signed_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              {agreement.template_url && (
                <button 
                  onClick={() => setSelectedAgreement(agreement)}
                  className="flex-1 md:flex-none glass px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                >
                  <Eye className="w-4 h-4" />
                  Review Terms
                </button>
              )}

              {agreement.status === 'pending' || agreement.status === 'rejected' ? (
                <button
                  onClick={() => setSelectedAgreement(agreement)}
                  className="flex-1 md:flex-none bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                >
                  <Upload className="w-4 h-4" />
                  Sign & Upload
                </button>
              ) : agreement.signed_url ? (
                <button 
                  onClick={() => handleViewFile(agreement.signed_url)}
                  className="flex-1 md:flex-none glass px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                >
                  <FileText className="w-4 h-4" />
                  View Signed
                </button>
              ) : null}
            </div>
          </motion.div>
        ))}

        {agreements.length === 0 && (
          <div className="glass p-12 rounded-3xl text-center">
            <div className="bg-primary/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="text-primary w-8 h-8" />
            </div>
            <h4 className="font-bold text-lg mb-2">No Agreements Issued</h4>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Once the founder issues a collaboration agreement, it will appear here for you to review, sign, and upload.
            </p>
          </div>
        )}
      </div>

      {/* Agreement Preview & Sign Modal */}
      <AnimatePresence>
        {selectedAgreement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-white/10 w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">{selectedAgreement.title}</h3>
                    <p className="text-sm text-muted-foreground">Review key terms and sign to activate your account</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedAgreement(null)}
                  className="p-2 hover:bg-white/5 rounded-full transition-all"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Key Terms Highlighting */}
                {selectedAgreement.key_terms && Array.isArray(selectedAgreement.key_terms) && selectedAgreement.key_terms.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-bold flex items-center gap-2 text-primary">
                      <Info className="w-4 h-4" />
                      Key Terms Highlighted
                    </h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      {selectedAgreement.key_terms.map((term: any, idx: number) => (
                        <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-primary/30 transition-all">
                          <span className="text-[10px] font-bold uppercase text-primary/60 block mb-1">
                            {term.category || 'Clause'}
                          </span>
                          <p className="text-sm font-medium">{term.content}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Agreement Preview (Iframe for PDF) */}
                <div className="space-y-4">
                  <h4 className="font-bold flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Agreement Document
                  </h4>
                  <div className="aspect-[4/3] w-full rounded-2xl overflow-hidden bg-black/40 border border-white/5">
                    {previewUrl ? (
                      <iframe 
                        src={`${previewUrl}#toolbar=0`} 
                        className="w-full h-full border-none"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                        {isLoading ? (
                          <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
                        ) : (
                          <>
                            <FileText className="w-16 h-16 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground mb-6">
                              Preparing document preview...
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer - Actions */}
              <div className="p-8 border-t border-white/5 bg-zinc-900/80 backdrop-blur-md">
                <div className="flex flex-col gap-6">
                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input 
                        type="checkbox" 
                        className="peer h-5 w-5 rounded border-white/10 bg-white/5 text-primary focus:ring-primary focus:ring-offset-0 transition-all"
                        checked={hasReadTerms}
                        onChange={(e) => setHasReadTerms(e.target.checked)}
                      />
                    </div>
                    <span className="text-sm text-muted-foreground group-hover:text-white transition-colors">
                      I have read, understood, and agree to the terms and conditions outlined in this agreement. 
                      I understand that signing this document will activate my {type} account privileges.
                    </span>
                  </label>

                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setSelectedAgreement(null)}
                      className="px-8 py-3 rounded-2xl glass font-bold hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                    
                    <label className={`flex-1 bg-primary text-white px-8 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-primary/20 ${
                      !hasReadTerms ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:opacity-90 cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                    }`}>
                      {isUploading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Upload className="w-5 h-5" />
                      )}
                      {selectedAgreement.status === 'rejected' ? 'Re-upload Signed PDF' : 'Upload Signed PDF & Activate'}
                      <input 
                        type="file" 
                        accept=".pdf" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUpload(selectedAgreement.id, file);
                        }}
                        disabled={!hasReadTerms || !!isUploading}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
