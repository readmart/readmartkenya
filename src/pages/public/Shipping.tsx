import { motion } from 'framer-motion';
import { Truck, Clock, ShieldCheck, MapPin, Mail } from 'lucide-react';

export default function Shipping() {
  const shippingMethods = [
    {
      icon: <Truck className="w-6 h-6" />,
      title: "Standard Delivery",
      time: "3-5 Business Days",
      price: "KSh 250",
      description: "Reliable delivery for your everyday reading needs across Kenya."
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: "Express Delivery",
      time: "1-2 Business Days",
      price: "KSh 500",
      description: "Priority shipping for when you just can't wait to start that next chapter."
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
            <Truck className="w-4 h-4" />
            Shipping Information
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6">Shipping Information</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
            Everything you need to know about getting your books delivered.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 mb-12"
        >
          <h2 className="text-2xl font-black mb-2">Our Shipping Partners</h2>
          <p className="text-muted-foreground">
            We work with reliable carriers to ensure your books arrive safely and on time.
          </p>
          <div className="mt-4 text-sm text-muted-foreground">
            No shipping carriers found.
          </div>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 mb-20">
          {shippingMethods.map((method, i) => (
            <motion.div
              key={method.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-8 flex flex-col items-center text-center group hover:border-primary/50 transition-colors"
            >
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                {method.icon}
              </div>
              <h3 className="text-xl font-bold mb-2">{method.title}</h3>
              <p className="text-primary font-black mb-4">{method.price} • {method.time}</p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {method.description}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            <h2 className="text-3xl font-black mb-8">Shipping FAQ</h2>
            
            <div className="space-y-6">
              <div className="glass-card p-6">
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  When will my order ship?
                </h4>
                <p className="text-muted-foreground text-sm">
                  Orders placed before 2 PM (local time) are processed the same day. Orders placed after 2 PM are processed the next business day.
                </p>
              </div>

              <div className="glass-card p-6">
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Can I change my shipping address?
                </h4>
                <p className="text-muted-foreground text-sm">
                  You can change your shipping address within 2 hours of placing your order. Contact our support team for assistance.
                </p>
              </div>

              <div className="glass-card p-6">
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Do you offer free shipping?
                </h4>
                <p className="text-muted-foreground text-sm">
                  Yes! Standard local shipping is free on all orders over KES 5,000.00 or when you buy 5 or more books. This is automatically applied at checkout.
                </p>
              </div>

              <div className="glass-card p-6">
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  What if my package is lost or damaged?
                </h4>
                <p className="text-muted-foreground text-sm">
                  Contact our support team immediately. We'll work with the carrier to locate your package or send a replacement at no extra cost.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-10 bg-secondary/10 border-secondary/20 flex flex-col justify-center text-center"
          >
            <h2 className="text-3xl font-black mb-6">Still have shipping questions?</h2>
            <p className="text-muted-foreground mb-8">
              Our dedicated shipping support team is here to help you with tracking, delivery issues, or local shipping inquiries across Kenya.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="mailto:support@readmartke.com"
                className="px-8 py-3 bg-primary text-white rounded-xl font-bold hover:opacity-90 transition-all inline-flex items-center gap-2 justify-center"
              >
                <Mail className="w-4 h-4" />
                Email Support
              </a>
              <a 
                href="/contact"
                className="px-8 py-3 glass rounded-xl font-bold hover:bg-white/10 transition-all inline-flex items-center gap-2 justify-center"
              >
                Use Contact Form
              </a>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Direct email: <span className="font-bold">shipping@readmartke.com</span>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
