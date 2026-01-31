import { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, ArrowRight, Mail } from 'lucide-react';
import { toast } from 'sonner';

export default function NewsletterStatus() {
  const [searchParams] = useSearchParams();
  const success = !window.location.pathname.includes('error');
  const reason = searchParams.get('reason');

  useEffect(() => {
    if (success) {
      toast.success('Subscription confirmed!');
    } else {
      toast.error(reason === 'expired' ? 'Confirmation link expired' : 'Invalid confirmation link');
    }
  }, [success, reason]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-gray-100"
      >
        <div className="flex justify-center">
          {success ? (
            <div className="bg-green-100 p-4 rounded-full">
              <CheckCircle className="w-16 h-16 text-green-600" />
            </div>
          ) : (
            <div className="bg-red-100 p-4 rounded-full">
              <XCircle className="w-16 h-16 text-red-600" />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-gray-900">
            {success ? 'You\'re Subscribed!' : 'Subscription Failed'}
          </h1>
          <p className="text-gray-600">
            {success 
              ? 'Thank you for confirming your subscription. You\'ll now receive our latest updates and exclusive offers directly in your inbox.'
              : reason === 'expired' 
                ? 'The confirmation link has expired. Please try subscribing again to receive a new link.'
                : 'The confirmation link is invalid or has already been used. Please try subscribing again.'
            }
          </p>
        </div>

        <div className="flex flex-col gap-4 pt-4">
          <Link 
            to="/shop" 
            className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors"
          >
            Start Shopping
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link 
            to="/" 
            className="text-gray-500 hover:text-gray-700 font-medium"
          >
            Back to Home
          </Link>
        </div>

        {success && (
          <div className="pt-6 border-t border-gray-100 flex items-center justify-center gap-2 text-sm text-gray-400">
            <Mail className="w-4 h-4" />
            <span>Check your inbox for a welcome gift!</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
