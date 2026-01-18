import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Layout from '@/components/layout/Layout';
import { lazyRetry } from '@/lib/utils';

// Public Pages
const Home = lazy(() => lazyRetry(() => import('@/pages/public/Home')));
const Shop = lazy(() => lazyRetry(() => import('@/pages/public/Shop')));
const BookDetail = lazy(() => lazyRetry(() => import('@/pages/public/BookDetail')));
const BookClub = lazy(() => lazyRetry(() => import('@/pages/public/BookClub')));
const Events = lazy(() => lazyRetry(() => import('@/pages/public/Events')));
const PartnershipApply = lazy(() => lazyRetry(() => import('@/pages/public/PartnershipApply')));
const AuthorApply = lazy(() => lazyRetry(() => import('@/pages/public/AuthorApply')));
const TrackOrder = lazy(() => lazyRetry(() => import('@/pages/public/TrackOrder')));

// Auth Pages
const Login = lazy(() => lazyRetry(() => import('@/pages/auth/Login')));
const Signup = lazy(() => lazyRetry(() => import('@/pages/auth/Signup')));
const AdminLogin = lazy(() => lazyRetry(() => import('@/pages/auth/AdminLogin')));
const ForgotPassword = lazy(() => lazyRetry(() => import('@/pages/auth/ForgotPassword')));
const ResetPassword = lazy(() => lazyRetry(() => import('@/pages/auth/ResetPassword')));

// User Pages
const Account = lazy(() => lazyRetry(() => import('@/pages/user/Account')));
const OrderHistory = lazy(() => lazyRetry(() => import('@/pages/user/OrderHistory')));
const Wishlist = lazy(() => lazyRetry(() => import('@/pages/user/Wishlist')));
const Cart = lazy(() => lazyRetry(() => import('@/pages/user/Cart')));
const Checkout = lazy(() => lazyRetry(() => import('@/pages/user/Checkout')));

// Dashboard Pages
const FounderDashboard = lazy(() => lazyRetry(() => import('@/pages/dashboard/FounderDashboard')));
const AuthorDashboard = lazy(() => lazyRetry(() => import('@/pages/dashboard/AuthorDashboard')));
const PartnerDashboard = lazy(() => lazyRetry(() => import('@/pages/dashboard/PartnerDashboard')));

// Info Pages
const About = lazy(() => lazyRetry(() => import('@/pages/public/About')));
const Contact = lazy(() => lazyRetry(() => import('@/pages/public/Contact')));
const Help = lazy(() => lazyRetry(() => import('@/pages/public/Help')));
const Shipping = lazy(() => lazyRetry(() => import('@/pages/public/Shipping')));
const Returns = lazy(() => lazyRetry(() => import('@/pages/public/Returns')));
const Privacy = lazy(() => lazyRetry(() => import('@/pages/public/Privacy')));
const Terms = lazy(() => lazyRetry(() => import('@/pages/public/Terms')));

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  </div>
);

function App() {
  return (
    <Router>
      <Layout>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/book/:id" element={<BookDetail />} />
              <Route path="/book-club" element={<BookClub />} />
              <Route path="/events" element={<Events />} />
              <Route path="/partnership/apply" element={<PartnershipApply />} />
              <Route path="/apply" element={<Navigate to="/partnership/apply" replace />} />
              <Route path="/author-apply" element={<AuthorApply />} />
              <Route path="/track-order" element={<TrackOrder />} />

              {/* Auth Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/admin-login" element={<AdminLogin />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Protected User Routes */}
              <Route path="/account" element={
                <ProtectedRoute>
                  <Account />
                </ProtectedRoute>
              } />
              <Route path="/orders" element={
                <ProtectedRoute>
                  <OrderHistory />
                </ProtectedRoute>
              } />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={
                <ProtectedRoute>
                  <Checkout />
                </ProtectedRoute>
              } />

              {/* Protected Dashboard Routes */}
              <Route path="/founder-dashboard" element={
                <ProtectedRoute allowedRoles={['founder', 'admin']}>
                  <FounderDashboard />
                </ProtectedRoute>
              } />
              <Route path="/author-dashboard" element={
                <ProtectedRoute allowedRoles={['author', 'admin', 'founder']}>
                  <AuthorDashboard />
                </ProtectedRoute>
              } />
              <Route path="/partner-dashboard" element={
                <ProtectedRoute allowedRoles={['partner', 'admin', 'founder']}>
                  <PartnerDashboard />
                </ProtectedRoute>
              } />

              {/* Info & Legal Routes */}
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/help" element={<Help />} />
              <Route path="/shipping" element={<Shipping />} />
              <Route path="/returns" element={<Returns />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      <Toaster position="top-center" richColors />
    </Router>
  );
}

export default App;
