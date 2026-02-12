# ReadMart Technical Intelligence Report

This report provides a comprehensive, end-to-end analysis of the ReadMart codebase, architecture, and operational environment. It is designed for senior engineers and AI systems to understand the project with zero prior context.

---

## 1️⃣ High-Level System Overview

### What the Product Is
ReadMart is a specialized e-commerce and community platform tailored for the Kenyan literary market. It combines a traditional bookstore with digital community features (Book Clubs) and professional services for authors and partners.

### Who the Users Are
*   **Customers**: Readers purchasing physical books, e-books, and literary merchandise.
*   **Authors**: Writers who use the platform to sell their work, manage digital assets (e-books), and track earnings/commissions.
*   **Partners**: Bookstores or vendors collaborating on distribution.
*   **Founders/Admins**: Internal operators managing site settings, CMS content, auditing, and financial oversight.

### Core Value Proposition
A unified literary ecosystem that localized the shopping experience (M-Pesa, Kenyan shipping zones) while providing tools for author empowerment and reader community building.

### Major Product Features
*   **E-commerce Hub**: Product catalog with category filtering, search, and a robust cart/checkout flow.
*   **Book Club System**: Community-driven clubs with memberships, private discussions, and event RSVPs.
*   **Multi-Role Dashboards**: Role-specific interfaces for Founders (global stats), Authors (book management), and Partners.
*   **Digital Content Management**: Secure e-book storage, password protection for digital files, and automated delivery.
*   **Localized Logistics**: Dynamic shipping calculation based on Kenyan towns and zones.
*   **Partnership Workflow**: Application system for authors and partners with agreement management.

---

## 2️⃣ Frontend Architecture

### Frameworks & Versions
*   **React 19**: The core UI library, utilizing modern features like `Suspense` for code splitting.
*   **Vite 7**: The build tool and development server, chosen for performance and modern ESM support.
*   **TypeScript**: Ensures type safety across the entire frontend.
*   **Tailwind CSS 4**: Used for styling with a modern, utility-first approach.

### App Structure
*   **Routing**: Handled by `react-router-dom` v7 in [App.tsx](file:///c:/Users/admin/Desktop/READMART/src/App.tsx).
    *   **Public Routes**: `/`, `/shop`, `/book/:id`, `/book-club`, `/events`, `/about`, etc.
    *   **Auth Routes**: `/login`, `/signup`, `/admin-login`, `/forgot-password`, `/reset-password`.
    *   **Protected Routes**: Wrapped in [ProtectedRoute.tsx](file:///c:/Users/admin/Desktop/READMART/src/components/auth/ProtectedRoute.tsx) for `/account`, `/orders`, `/checkout`, and all dashboards.
*   **Layouts**: [Layout.tsx](file:///c:/Users/admin/Desktop/READMART/src/components/layout/Layout.tsx) provides a consistent shell with [Navbar.tsx](file:///c:/Users/admin/Desktop/READMART/src/components/layout/Navbar.tsx) and [Footer.tsx](file:///c:/Users/admin/Desktop/READMART/src/components/layout/Footer.tsx).
*   **Pages**: Organized by domain in `src/pages/` (e.g., `auth/`, `bookclub/`, `dashboard/`, `public/`, `user/`).

### State Management Strategy
*   **Server State**: Managed by `@tanstack/react-query` for efficient data fetching, caching, and background synchronization.
*   **Client State**: 
    *   **Context API**: Used for global concerns like [AuthContext.tsx](file:///c:/Users/admin/Desktop/READMART/src/contexts/AuthContext.tsx), [CartContext.tsx](file:///c:/Users/admin/Desktop/READMART/src/contexts/CartContext.tsx), [CurrencyContext.tsx](file:///c:/Users/admin/Desktop/READMART/src/contexts/CurrencyContext.tsx), and [WishlistContext.tsx](file:///c:/Users/admin/Desktop/READMART/src/contexts/WishlistContext.tsx).

### Data Fetching Patterns
*   Uses a combination of direct Supabase client calls (in components or custom hooks) and Vercel serverless API calls for sensitive logic (payments, admin tasks).
*   **Resilience**: Implements a `withRetry` helper in [retry.ts](file:///c:/Users/admin/Desktop/READMART/src/lib/retry.ts) to handle transient network or Supabase schema cache issues.

### UI Libraries & Animation
*   **Framer Motion**: Powering all UI animations and transitions.
*   **Lucide React**: Standard icon set.
*   **Sonner**: Modern toast notifications.
*   **Recharts**: Used for data visualization in dashboards.

---

## 3️⃣ Backend & API Architecture

### API Routes (Vercel Serverless)
Located in `api/`, these Node.js functions handle logic that requires server-side secrets or complex orchestration.

| Domain | Endpoint | Purpose |
| :--- | :--- | :--- |
| **Auth** | [auth.ts](file:///c:/Users/admin/Desktop/READMART/api/auth.ts) | Session creation, verification, and custom JWT issuance. |
| **Payments** | [payments.ts](file:///c:/Users/admin/Desktop/READMART/api/payments.ts) | KopoKopo STK Push initiation and webhook handling. |
| **Orders** | [orders.ts](file:///c:/Users/admin/Desktop/READMART/api/orders.ts) | Secure order creation and processing. |
| **Products** | [products.ts](file:///c:/Users/admin/Desktop/READMART/api/products.ts) | Product fetching with fallback for schema cache issues. |
| **Dashboards**| [dashboards.ts](file:///c:/Users/admin/Desktop/READMART/api/dashboards.ts)| Aggregated statistics for Founder/Author roles. |
| **Newsletter**| [newsletter.ts](file:///c:/Users/admin/Desktop/READMART/api/newsletter.ts)| Subscription management and status verification. |

### Auth & Authorization Flow
1.  Frontend authenticates with Supabase Auth.
2.  Frontend calls `api/auth.ts?action=create-session` with the Supabase UID.
3.  Backend issues a custom JWT (signed with `JWT_SECRET`) containing the user's role and ID.
4.  Subsequent API calls include this JWT in the `Authorization` header.
5.  Backend verifies the JWT using `verifyJWT` in [_utils.ts](file:///c:/Users/admin/Desktop/READMART/api/_utils.ts).

### Middleware & Security Logic
*   **CORS**: Configured in `vercel.json` and manually set in some handlers.
*   **Error Handling**: Centralized in `serverError` and `badRequest` helpers in [_utils.ts](file:///c:/Users/admin/Desktop/READMART/api/_utils.ts).
*   **Audit Logging**: Every sensitive action (login, payment, etc.) is logged via `logAction` to the `audit_logs` table.

---

## 4️⃣ Supabase Architecture (DEEP DIVE)

### Database Schema
The schema is highly normalized and iterative, documented in `supabase/migrations/`.

*   **Core Tables**:
    *   `profiles`: Extends `auth.users` with `role`, `full_name`, and metadata.
    *   `products`: Main catalog, including fields for `ebook_file_path` and physical attributes (`weight`, `volume`).
    *   `orders` & `order_items`: Transaction records, including shipping details and product snapshots.
    *   `banners`, `book_clubs`, `events`, `announcements`: Dedicated tables for CMS content (previously a polymorphic `cms_content` table).
*   **Advanced Features**:
    *   `order_commissions`: Tracks revenue share for authors and partners.
    *   `site_settings`: Single-row table for global configuration (logos, contacts, social links).
    *   `shipping_zones` & `kenyan_towns`: Localized delivery logic.

### Auth Setup (Roles & RLS)
*   **Roles**: `customer` (default), `author`, `partner`, `admin`, `founder`.
*   **RLS Policies**: Implemented on every table. Example:
    *   `orders`: Users can only view their own; admins can view all.
    *   `products`: Public can view `is_active = true`; admins can manage all.
*   **Triggers**: `on_auth_user_created` automatically inserts a record into `public.profiles` upon signup.

### Storage Usage
Managed via `storage.buckets`:
*   `products` (Public): Product images.
*   `banners` (Public): Hero images and promotional banners.
*   `ebooks` (Private): Digital book files, restricted to owners and admins.
*   `partnership_documents` (Private): Sensitive application documents.

---

## 5️⃣ Payments & Monetization

### Payment Provider
**KopoKopo (K2)** is the primary provider, integrated for M-Pesa (STK Push, Paybill, Buy Goods).

### Core Payment Files
*   [api/payments.ts](file:///c:/Users/admin/Desktop/READMART/api/payments.ts): Main handler for initiation and webhooks.
*   [api/_payments.ts](file:///c:/Users/admin/Desktop/READMART/api/_payments.ts): Low-level K2 API client (token management, signature verification).

### Checkout Flow
1.  User selects M-Pesa at checkout.
2.  Frontend calls `api/payments.ts?action=init`.
3.  Backend calls K2 STK Push API.
4.  User enters PIN on phone.
5.  K2 sends a webhook to `api/payments.ts?action=webhook`.
6.  Backend verifies signature, updates order to `paid`, and calculates commissions.

---

## 6️⃣ Auth & Security

### Supabase Auth vs Custom Auth
*   **Supabase Auth**: Used for the primary identity layer (session management, email verification).
*   **Custom JWT**: A secondary layer (via `jose`) used to authorize serverless API calls. This is a common pattern to bridge the gap between Supabase and non-Supabase backend functions.

### Password Handling
*   Managed entirely by Supabase Auth (Argon2 or BCrypt).
*   E-book files can have an additional `password` field in `products` for extra security on digital deliveries.

### Security Risks
*   **JWT Sync**: If `JWT_SECRET` is not perfectly synced between Vercel and Supabase (if used there), auth will fail.
*   **Role Management**: Role changes must be done carefully in the `profiles` table as the custom JWT issuance depends on it.

---

## 7️⃣ Infrastructure & Deployment

### Vercel Setup
*   **Framework**: Vite / React.
*   **Functions**: Located in `api/`, configured via `vercel.json`.
*   **Analytics**: Integrated via `@vercel/analytics`.

### Environment Variables (Critical)
*   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`: Public Supabase config.
*   `SUPABASE_SERVICE_ROLE_KEY`: Private key for backend administrative tasks.
*   `JWT_SECRET`: Secret for signing custom API tokens.
*   `KOPOKOPO_API_KEY`, `KOPOKOPO_CLIENT_ID`, `KOPOKOPO_CLIENT_SECRET`: Payment credentials.
*   `RESEND_API_KEY`: For transactional emails.

---

## 8️⃣ Tooling & Developer Experience

### Scripts (`package.json`)
*   `npm run dev`: Vite development server.
*   `npm run monitor`: Runs [scripts/monitor-functions.ts](file:///c:/Users/admin/Desktop/READMART/scripts/monitor-functions.ts) to check API health.
*   `npm run bootstrap`: [scripts/bootstrap.ts](file:///c:/Users/admin/Desktop/READMART/scripts/bootstrap.ts) for environment setup.

### Developer Utilities
*   A vast library of maintenance scripts in `scripts/` for database auditing, storage verification, and schema synchronization.
*   **Testing**: Vitest for unit tests (e.g., [api-helpers.test.ts](file:///c:/Users/admin/Desktop/READMART/src/lib/utils/__tests__/api-helpers.test.ts)).

---

## 9️⃣ Domain Mapping

| Domain | Files | Tables | APIs |
| :--- | :--- | :--- | :--- |
| **Auth** | `AuthContext.tsx`, `Login.tsx` | `profiles` | `api/auth.ts` |
| **Catalog** | `Shop.tsx`, `BookDetail.tsx` | `products`, `categories` | `api/products.ts` |
| **Commerce** | `Cart.tsx`, `Checkout.tsx` | `orders`, `order_items` | `api/orders.ts` |
| **Payments** | `api/payments.ts` | `transactions` | `api/payments.ts` |
| **Community**| `BookClubHub.tsx` | `book_clubs`, `book_club_members`| `api/community.ts` |
| **Admin** | `FounderDashboard.tsx` | `site_settings`, `audit_logs` | `api/dashboards.ts` |

---

## 🔟 Gaps, Smells & Risks

*   **Architectural Inconsistency**: The project uses both direct Supabase calls and a custom API layer. This can lead to "split-brain" logic where some rules are enforced in RLS and others in API code.
*   **Schema Cache Sensitivity**: Multiple API handlers have explicit retries for "column missing" errors. This indicates that Supabase PostgREST occasionally lags behind migrations in the Vercel environment.
*   **API/RLS Hybrid**: The project uses both direct Supabase calls and a custom API layer. This can lead to "split-brain" logic if not managed carefully.

---

## 1️⃣1️⃣ Refactor & Evolution Readiness

### What can be safely reused
*   **Payment Module**: The KopoKopo integration is robust and well-isolated in `api/_payments.ts`.
*   **UI System**: The Tailwind 4 + Framer Motion setup is modern and highly performant.

### Evolution Strategy
*   **M-Pesa**: Already fully integrated; can easily add more K2 features like B2B payments.
*   **Book Clubs**: The foundation exists; could be evolved into a real-time chat system by integrating Supabase Realtime.
*   **Subscriptions**: Structure is in place via `membership_system` migration; needs frontend activation in [Membership.tsx](file:///c:/Users/admin/Desktop/READMART/src/pages/public/Membership.tsx).

---
*Report Generated: 2026-02-04*
