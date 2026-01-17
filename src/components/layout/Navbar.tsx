import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingCart, User, Heart, Search, Menu, X, 
  LayoutDashboard, LogOut, ShoppingBag,
  BookOpen, Calendar, ChevronDown
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useWishlist } from '@/contexts/WishlistContext';

export default function Navbar() {
  const { user, profile, logout } = useAuth();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const location = useLocation();

  // Close menus on navigation
  useEffect(() => {
    setIsMenuOpen(false);
    setIsProfileOpen(false);
    setIsExploreOpen(false);
  }, [location.pathname]);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      if (isProfileOpen && !target.closest('.profile-dropdown')) {
        setIsProfileOpen(false);
      }
      if (isExploreOpen && !target.closest('.explore-dropdown')) {
        setIsExploreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileOpen, isExploreOpen]);

  const exploreLinks = [
    { name: 'All Books', href: '/shop?category=All', icon: <ShoppingBag className="w-4 h-4" /> },
    { name: 'Art & Accessories', href: '/shop?category=Art & Accessories', icon: <Heart className="w-4 h-4" /> },
    { name: 'Book Club', href: '/book-club', icon: <BookOpen className="w-4 h-4" /> },
    { name: 'Events', href: '/events', icon: <Calendar className="w-4 h-4" /> },
  ];

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Shop', href: '/shop' },
    { name: 'Book Club', href: '/book-club' },
  ];

  const dashboardLink = profile?.role === 'founder' 
    ? { name: 'Founder Hub', href: '/founder-dashboard', icon: <LayoutDashboard className="w-4 h-4" /> }
    : profile?.role === 'author'
    ? { name: 'Author Hub', href: '/author-dashboard', icon: <LayoutDashboard className="w-4 h-4" /> }
    : profile?.role === 'partner'
    ? { name: 'Partner Hub', href: '/partner-dashboard', icon: <LayoutDashboard className="w-4 h-4" /> }
    : null;

  return (
    <nav className="glass-nav flex items-center justify-between sticky top-0 z-[100]">
      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center gap-2">
          <img src="/assets/logo.jpg" alt="ReadMart" className="h-10 w-auto rounded" />
        </Link>

        <div className="hidden lg:flex items-center gap-6 text-sm font-medium">
          {/* Explore Dropdown */}
          <div className="relative explore-dropdown">
            <button 
              onClick={() => setIsExploreOpen(!isExploreOpen)}
              className={`hover:text-primary transition-colors flex items-center gap-1 font-black uppercase tracking-widest text-[10px] ${isExploreOpen ? 'text-primary' : ''}`}
            >
              Explore
              <motion.div
                animate={{ rotate: isExploreOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-3 h-3" />
              </motion.div>
            </button>

            <AnimatePresence>
              {isExploreOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute left-0 mt-4 w-56 glass rounded-3xl p-2 border border-white/10 shadow-2xl overflow-hidden"
                >
                  <div className="space-y-1">
                    {exploreLinks.map((link) => (
                      <Link 
                        key={link.name} 
                        to={link.href}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/5 transition-all text-xs font-bold"
                      >
                        <span className="p-2 rounded-xl bg-primary/10 text-primary">
                          {link.icon}
                        </span>
                        {link.name}
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              to={link.href} 
              className="hover:text-primary transition-colors font-black uppercase tracking-widest text-[10px]"
            >
              {link.name}
            </Link>
          ))}
          
          {dashboardLink && (
            <Link to={dashboardLink.href} className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-[10px] hover:opacity-80 transition-all">
              {dashboardLink.name}
            </Link>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search books..." 
            className="pl-10 pr-4 py-2 rounded-full bg-muted/50 border-none focus:ring-2 focus:ring-primary text-sm w-64 transition-all focus:w-80"
          />
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link to="/wishlist" className="p-2 hover:bg-primary/10 rounded-full transition-colors relative group">
            <Heart className="h-5 w-5 group-hover:scale-110 transition-transform" />
            {wishlistCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-secondary text-white text-[10px] font-bold min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center animate-in zoom-in">
                {wishlistCount}
              </span>
            )}
          </Link>
          <Link to="/cart" className="p-2 hover:bg-primary/10 rounded-full transition-colors relative group">
            <ShoppingCart className="h-5 w-5 group-hover:scale-110 transition-transform" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center animate-in zoom-in">
                {cartCount}
              </span>
            )}
          </Link>
          
          {/* User Profile Dropdown */}
          <div className="relative profile-dropdown">
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className={`p-2 rounded-full transition-all ${isProfileOpen ? 'bg-primary/20 text-primary' : 'hover:bg-primary/10'}`}
            >
              <User className="h-5 w-5" />
            </button>
            
            <AnimatePresence>
              {isProfileOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-3 w-64 glass rounded-3xl p-2 border border-white/10 shadow-2xl overflow-hidden"
                >
                  {user ? (
                    <div className="space-y-1">
                      <div className="px-4 py-3 border-b border-white/5 mb-2">
                        <p className="text-sm font-black truncate">{profile?.full_name || 'User'}</p>
                        <p className="text-[10px] text-muted-foreground truncate uppercase tracking-widest">{user.email}</p>
                      </div>
                      <Link to="/account" className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/5 transition-all text-sm font-bold">
                        <User className="w-4 h-4" />
                        Account Settings
                      </Link>
                      {dashboardLink && (
                        <Link to={dashboardLink.href} className="flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-white/5 transition-all text-sm font-bold text-primary">
                          {dashboardLink.icon}
                          {dashboardLink.name}
                        </Link>
                      )}
                      <button 
                        onClick={() => logout()}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-red-500/10 text-red-500 transition-all text-sm font-bold mt-2"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 space-y-4 text-center">
                      <p className="text-sm font-medium text-muted-foreground">Welcome to ReadMart</p>
                      <Link 
                        to="/login" 
                        className="block w-full py-3 bg-primary text-white rounded-2xl font-black text-sm hover:shadow-lg hover:shadow-primary/20 transition-all"
                      >
                        Sign In
                      </Link>
                      <Link 
                        to="/register" 
                        className="block w-full py-3 glass rounded-2xl font-black text-sm hover:bg-white/5 transition-all"
                      >
                        Create Account
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 hover:bg-primary/10 rounded-full transition-colors"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md z-[90] lg:hidden"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-[80%] max-w-sm glass bg-slate-900/95 dark:bg-slate-950/95 z-[100] lg:hidden p-8 flex flex-col gap-8"
            >
              <div className="flex items-center justify-between mb-4">
                <img src="/assets/logo.jpg" alt="ReadMart" className="h-10 w-auto rounded" />
                <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-white/5 rounded-full">
                  <X className="h-6 h-6" />
                </button>
              </div>

              {/* Mobile Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Search books..." 
                  className="w-full pl-10 pr-4 py-4 rounded-2xl bg-white/5 border border-white/10 focus:ring-2 focus:ring-primary text-sm"
                />
              </div>

              <div className="flex flex-col gap-6 overflow-y-auto no-scrollbar pb-20">
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2">Explore</p>
                  <div className="grid gap-2">
                    {exploreLinks.map((link) => (
                      <Link 
                        key={link.name} 
                        to={link.href}
                        className="flex items-center gap-4 px-6 py-4 rounded-2xl hover:bg-white/5 transition-all group"
                      >
                        <span className="p-3 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                          {link.icon}
                        </span>
                        <span className="font-bold text-sm">{link.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2">Menu</p>
                  <div className="grid gap-2">
                    {navLinks.map((link) => (
                      <Link 
                        key={link.name} 
                        to={link.href}
                        className="px-6 py-4 rounded-2xl hover:bg-white/5 font-bold text-sm transition-all"
                      >
                        {link.name}
                      </Link>
                    ))}
                    {dashboardLink && (
                      <Link 
                        to={dashboardLink.href}
                        className="flex items-center gap-4 px-6 py-4 rounded-2xl bg-primary/10 text-primary font-black text-sm"
                      >
                        {dashboardLink.icon}
                        {dashboardLink.name}
                      </Link>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-8 border-t border-white/5 space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground px-2">Account</p>
                  {user ? (
                    <div className="grid gap-2">
                      <Link 
                        to="/account"
                        className="flex items-center gap-4 px-6 py-4 rounded-2xl hover:bg-white/5 font-bold text-sm"
                      >
                        <User className="w-5 h-5" />
                        My Profile
                      </Link>
                      <button 
                        onClick={() => logout()}
                        className="w-full flex items-center gap-4 px-6 py-4 rounded-2xl hover:bg-red-500/10 text-red-500 transition-all text-sm font-bold"
                      >
                        <LogOut className="w-5 h-5" />
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      <Link 
                        to="/login"
                        className="w-full py-4 bg-primary text-white rounded-2xl font-black text-center text-sm shadow-lg shadow-primary/20"
                      >
                        Sign In
                      </Link>
                      <Link 
                        to="/register"
                        className="w-full py-4 glass rounded-2xl font-black text-center text-sm hover:bg-white/5"
                      >
                        Create Account
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
