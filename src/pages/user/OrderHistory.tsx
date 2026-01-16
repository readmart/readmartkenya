import { motion } from 'framer-motion';
import { Package, ChevronRight, Calendar, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';

const mockOrders = [
  {
    id: 'ORD-2026-001',
    date: 'Jan 12, 2026',
    status: 'Delivered',
    total: 48.49,
    items: ['The Midnight Library', 'Atomic Habits'],
  },
  {
    id: 'ORD-2026-002',
    date: 'Jan 15, 2026',
    status: 'Processing',
    total: 29.99,
    items: ['Dune'],
  },
];

export default function OrderHistory() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Order History</h1>

        <div className="space-y-6">
          {mockOrders.map((order, index) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass p-8 rounded-3xl"
            >
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-2xl">
                      <Package className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{order.id}</h3>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          {order.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <CreditCard className="w-4 h-4" />
                          ${order.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {order.items.map(item => (
                      <span key={item} className="glass px-3 py-1 rounded-full text-xs font-medium">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between md:flex-col md:items-end md:justify-center gap-4">
                  <span className={`px-4 py-2 rounded-xl text-sm font-bold ${
                    order.status === 'Delivered' 
                      ? 'bg-green-500/20 text-green-500' 
                      : 'bg-orange-500/20 text-orange-500'
                  }`}>
                    {order.status}
                  </span>
                  <Link 
                    to={`/track-order?id=${order.id}`}
                    className="flex items-center gap-1 text-primary font-bold hover:underline group"
                  >
                    View Details
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
