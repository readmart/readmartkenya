import { motion } from 'framer-motion';
import { ShieldCheck, User, CreditCard, Mail, Database, Cookie, CheckCircle } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-black uppercase tracking-widest mb-6">
            <ShieldCheck className="w-4 h-4" />
            Privacy Policy
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6">Your privacy matters to us</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
            Learn how we collect, use, and protect your data.
          </p>
          <p className="text-sm text-muted-foreground mt-4">Last updated: December 12, 2024</p>
        </motion.div>

        <div className="space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <User className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-black">1. Information We Collect</h2>
            </div>
            <p className="text-muted-foreground mb-4">
              We collect information you provide directly to us, such as when you create an account, make a purchase, contact us, or participate in any interactive features of our services. This information may include:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Name, email address, and contact information</li>
              <li>Billing and shipping addresses</li>
              <li>Payment information (processed securely by our payment providers)</li>
              <li>Order history and preferences</li>
              <li>Communications you send to us</li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-black">2. How We Use Your Information</h2>
            </div>
            <p className="text-muted-foreground mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Process and fulfill your orders</li>
              <li>Send you order confirmations and shipping updates</li>
              <li>Respond to your comments, questions, and requests</li>
              <li>Send promotional communications (with your consent)</li>
              <li>Improve and personalize your shopping experience</li>
              <li>Detect and prevent fraud</li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-black">3. Information Sharing</h2>
            </div>
            <p className="text-muted-foreground">
              We do not sell, trade, or otherwise transfer your personal information to outside parties except to trusted third parties who assist us in operating our website, conducting our business, or serving you, so long as those parties agree to keep this information confidential.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-black">4. Data Security</h2>
            </div>
            <p className="text-muted-foreground">
              We implement a variety of security measures to maintain the safety of your personal information. All transactions are processed through a secure server using SSL encryption technology.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <Cookie className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-black">5. Cookies</h2>
            </div>
            <p className="text-muted-foreground">
              We use cookies to enhance your experience on our site. Cookies are small files that a site or its service provider transfers to your computer's hard drive through your web browser that enables the site's systems to recognize your browser and capture and remember certain information.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-black">6. Your Rights</h2>
            </div>
            <p className="text-muted-foreground mb-4">
              You have the right to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Opt-out of marketing communications</li>
              <li>Export your data in a portable format</li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-black">7. Contact Us</h2>
            </div>
            <p className="text-muted-foreground">
              If you have any questions about this Privacy Policy, please contact us at <span className="font-bold">privacy@readmart.com</span> or through our contact page.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
