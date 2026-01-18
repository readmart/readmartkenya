import { motion } from 'framer-motion';
import { FileText, Shield, UserCheck, CreditCard, Tag, Copyright, AlertTriangle, RefreshCcw, Mail } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-black uppercase tracking-widest mb-6">
            <FileText className="w-4 h-4" />
            Terms of Service
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6">Please read these terms carefully</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
            Before using ReadMart, review the terms that govern your use of our services.
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
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-black">1. Acceptance of Terms</h2>
            </div>
            <p className="text-muted-foreground">
              By accessing and using ReadMart, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <UserCheck className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-black">2. Use of Service</h2>
            </div>
            <p className="text-muted-foreground mb-4">
              You agree to use ReadMart only for lawful purposes. You are prohibited from posting on or transmitting through ReadMart any material that:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Is unlawful, harmful, threatening, or abusive</li>
              <li>Infringes on any patent, trademark, or copyright</li>
              <li>Contains software viruses or any other malicious code</li>
              <li>Constitutes unauthorized advertising or spam</li>
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <UserCheck className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-black">3. Account Registration</h2>
            </div>
            <p className="text-muted-foreground">
              To access certain features, you may be required to create an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-black">4. Orders and Payment</h2>
            </div>
            <p className="text-muted-foreground">
              When you place an order, you are offering to purchase a product on and subject to these terms. All orders are subject to availability and confirmation of the order price. We reserve the right to refuse any order for any reason.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <Tag className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-black">5. Pricing and Availability</h2>
            </div>
            <p className="text-muted-foreground">
              All prices are shown in your selected currency and are subject to change without notice. We make every effort to display accurate pricing, but errors may occur. If we discover a pricing error, we will contact you to confirm if you wish to proceed at the correct price.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <Copyright className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-black">6. Intellectual Property</h2>
            </div>
            <p className="text-muted-foreground">
              All content included on ReadMart, such as text, graphics, logos, images, and software, is the property of ReadMart or its content suppliers and is protected by international copyright laws.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-black">7. Limitation of Liability</h2>
            </div>
            <p className="text-muted-foreground">
              ReadMart shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your access to or use of, or inability to access or use, the services or any content.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <RefreshCcw className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-black">8. Changes to Terms</h2>
            </div>
            <p className="text-muted-foreground">
              We reserve the right to modify these terms at any time. We will notify users of any changes by posting the new Terms of Service on this page and updating the "Last updated" date.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-5 h-5 text-primary" />
              <h2 className="text-2xl font-black">9. Contact Information</h2>
            </div>
            <p className="text-muted-foreground">
              If you have any questions about these Terms, please contact us at <span className="font-bold">legal@readmart.com</span> or through our contact page.
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-10 mt-12 text-center"
        >
          <h3 className="text-2xl font-black mb-3">Stay in the Loop</h3>
          <p className="text-muted-foreground mb-6">
            Join our community to receive updates on new releases, exclusive events, and literary news.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 max-w-xl mx-auto">
            <input
              type="email"
              placeholder="your@email.com"
              className="bg-white/5 border border-white/10 rounded-xl px-6 py-3 outline-none focus:bg-white/10 transition-all flex-1"
            />
            <button className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-all">
              Join
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
