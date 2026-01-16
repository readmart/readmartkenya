import { motion } from 'framer-motion';

export default function Shipping() {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="container mx-auto px-4 py-12"
    >
      <div className="glass-card">
        <h1 className="text-3xl font-bold mb-4">Shipping</h1>
        <p className="text-muted-foreground">This page is under construction.</p>
      </div>
    </motion.div>
  );
}
