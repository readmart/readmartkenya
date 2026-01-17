import { motion } from 'framer-motion';
import { Truck, Globe, Clock, ShieldCheck, MapPin } from 'lucide-react';

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
    {
      icon: <Globe className="w-6 h-6" />,
      title: "International Shipping",
      time: "7-14 Business Days",
      price: "Calculated at Checkout",
      description: "Bringing African literature to the global stage. Rates vary by destination."
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
            <Truck className="w-4 h-4" />
            Logistics & Delivery
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6">Fast, Reliable Shipping</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
            We've partnered with the best logistics providers to ensure your books reach you safely and swiftly, no matter where you are.
          </p>
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
                  <MapPin className="w-4 h-4 text-primary" />
                  Do you deliver to rural areas?
                </h4>
                <p className="text-muted-foreground text-sm">
                  Yes! We deliver to all major towns and rural areas across Kenya via G4S and other reliable couriers.
                </p>
              </div>

              <div className="glass-card p-6">
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  Is my package insured?
                </h4>
                <p className="text-muted-foreground text-sm">
                  Every shipment is fully insured against loss or damage during transit, ensuring your peace of mind.
                </p>
              </div>

              <div className="glass-card p-6">
                <h4 className="font-bold mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  When will my order ship?
                </h4>
                <p className="text-muted-foreground text-sm">
                  Orders placed before 2 PM are typically processed and shipped the same business day.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-card p-10 bg-primary text-white flex flex-col justify-center text-center"
          >
            <h2 className="text-3xl font-black mb-6">Track Your Order</h2>
            <p className="mb-8 opacity-90">
              Once your order has shipped, you'll receive a tracking number via email and SMS. Use it to follow your package's journey.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <input 
                type="text" 
                placeholder="Enter Tracking Number"
                className="bg-white/10 border border-white/20 rounded-xl px-6 py-3 outline-none focus:bg-white/20 transition-all flex-1 text-white placeholder:text-white/50"
              />
              <button className="bg-white text-primary px-8 py-3 rounded-xl font-bold hover:bg-opacity-90 transition-all">
                Track Now
              </button>
            </div>
            <p className="mt-6 text-xs opacity-75 italic">
              * Tracking information may take up to 24 hours to appear.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
