import { motion } from 'framer-motion';
import { RefreshCcw, ShieldCheck, Clock, FileText, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Returns() {
  const returnSteps = [
    {
      icon: <FileText className="w-6 h-6" />,
      title: "Check Eligibility",
      description: "Ensure the item is in its original condition and within the 30-day return window."
    },
    {
      icon: <RefreshCcw className="w-6 h-6" />,
      title: "Start Request",
      description: "Log in to your account and select the order you wish to return to generate a label."
    },
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: "Pack & Ship",
      description: "Pack the item securely and drop it off at any of our partner collection points."
    }
  ];

  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-black uppercase tracking-widest mb-6">
            <RefreshCcw className="w-4 h-4" />
            Returns & Refunds
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6">Easy Returns Policy</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
            Not quite what you expected? No worries. Our hassle-free return policy ensures you can shop with absolute confidence.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {returnSteps.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-8 flex flex-col items-center text-center group"
            >
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6 relative">
                <span className="absolute -top-2 -right-2 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-black text-sm">
                  {i + 1}
                </span>
                {step.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h2 className="text-3xl font-black mb-8">Return Policy Details</h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="mt-1">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold mb-1">30-Day Return Window</h4>
                  <p className="text-muted-foreground text-sm">
                    Items must be returned within 30 days of delivery for a full refund or exchange.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="mt-1">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold mb-1">Condition Requirements</h4>
                  <p className="text-muted-foreground text-sm">
                    Books must be in their original condition, free of marks, creases, or damage.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="mt-1">
                  <HelpCircle className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold mb-1">Non-Returnable Items</h4>
                  <p className="text-muted-foreground text-sm">
                    Digital e-books and items marked as "Final Sale" cannot be returned or refunded once accessed.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-10 bg-secondary/10 border-secondary/20"
          >
            <h2 className="text-3xl font-black mb-6">Need Help?</h2>
            <p className="text-muted-foreground mb-8">
              Our support team is here to assist you with any questions regarding your return or refund status.
            </p>
            <div className="space-y-4">
              <Link 
                to="/contact"
                className="block w-full py-4 bg-primary text-white rounded-2xl font-black text-center hover:opacity-90 transition-all shadow-lg shadow-primary/20"
              >
                Contact Support
              </Link>
              <Link 
                to="/help"
                className="block w-full py-4 glass rounded-2xl font-black text-center hover:bg-white/10 transition-all"
              >
                View Help Center
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
