import { motion } from 'framer-motion';
import { RefreshCcw, ShieldCheck, Clock, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Returns() {
  const features = [
    {
      icon: <Clock className="w-6 h-6" />,
      title: "14-Day Returns",
      description: "Return any book within 14 days of delivery."
    },
    {
      icon: <RefreshCcw className="w-6 h-6" />,
      title: "Free Return Shipping",
      description: "We provide prepaid return labels for hassle-free returns."
    },
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: "Quick Refunds",
      description: "Refunds processed within 5–7 business days."
    },
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
            Returns & Exchanges
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6">Easy, hassle-free returns</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
            Your satisfaction is our priority. Shop with confidence knowing returns are simple and fast.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-8 flex flex-col items-center text-center group"
            >
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6 relative">
                <span className="absolute -top-2 -right-2 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-black text-sm">
                  {i + 1}
                </span>
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
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
                  <h4 className="font-bold mb-1">1. Eligibility</h4>
                  <ul className="text-muted-foreground text-sm list-disc pl-5 space-y-2">
                    <li>Books must be in original condition (unread, unmarked).</li>
                    <li>Returns must be initiated within 14 days of delivery.</li>
                    <li>Original packaging is preferred but not required.</li>
                    <li>Gift receipts are accepted for store credit.</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="mt-1">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold mb-1">2. Non-Returnable Items</h4>
                  <ul className="text-muted-foreground text-sm list-disc pl-5 space-y-2">
                    <li>Digital downloads and eBooks.</li>
                    <li>Items marked as “Final Sale”.</li>
                    <li>Gift cards.</li>
                    <li>Books with visible signs of heavy use.</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="mt-1">
                  <HelpCircle className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h4 className="font-bold mb-1">3. The Process</h4>
                  <ol className="text-muted-foreground text-sm list-decimal pl-5 space-y-2">
                    <li>Log in to your account and find your order.</li>
                    <li>Select “Return Item” and choose your reason.</li>
                    <li>Print the prepaid shipping label provided.</li>
                    <li>Drop off the package at any authorized carrier location.</li>
                  </ol>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-10 bg-secondary/10 border-secondary/20"
          >
            <h2 className="text-3xl font-black mb-6">Need help with a return?</h2>
            <p className="text-muted-foreground mb-8">
              Our support team is available 24/7 to assist you with any return or exchange questions.
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
