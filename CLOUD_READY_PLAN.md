# ReadMart Cloud Deployment & Implementation Plan

This document provides a comprehensive assessment of the infrastructure requirements, architecture analysis, and detailed implementation plans for the remaining features of ReadMart.

## 1. Architecture Analysis & Local Dependencies

### Local Machine Dependencies
The application is designed with cloud-native principles, but some development-specific bypasses and configurations exist:

- **Auth Context Bypass:** `localStorage.getItem('rm_dev_role')` is used in [AuthContext.tsx](file:///c:/Users/admin/Desktop/READMART/src/contexts/AuthContext.tsx) to mock user roles during development. This will not interfere with production but should be removed or disabled in the final production build.
- **HTTPS Enforcement:** [useHttpsEnforcement.ts](file:///c:/Users/admin/Desktop/READMART/src/hooks/useHttpsEnforcement.ts) skips redirection for `localhost` and `127.0.0.1`.
- **Callback URLs:** Webhook and callback URLs in [_payments.ts](file:///c:/Users/admin/Desktop/READMART/api/_payments.ts) dynamically detect the environment using `VERCEL_URL` or `PUBLIC_DOMAIN`.
- **Database Connection:** Currently relies on Supabase connection strings. No local PostgreSQL dependency is required for the application to run.
- **File Storage:** Relies on Supabase Storage. No local file path dependencies were found in the core logic.

### Infrastructure Requirements Checklist
- [ ] **Supabase Project:**
    - [ ] Database (PostgreSQL)
    - [ ] Authentication (Email/Password, OAuth)
    - [ ] Storage Buckets (product-images, avatars, documents)
    - [ ] Realtime enabled for all core tables
    - [ ] Edge Functions (optional, currently using Vercel)
- [ ] **Vercel Hosting:**
    - [ ] Frontend (React/Vite)
    - [ ] Serverless Functions (api/*)
- [ ] **Third-Party Services:**
    - [ ] **KopoKopo:** Payment processing (STK Push, B2C, SMS)
    - [ ] **Resend:** Transactional and marketing emails
- [ ] **Monitoring & Security:**
    - [ ] SSL/TLS Certificate (managed by Vercel)
    - [ ] CORS configuration (managed by `vercel.json`)
    - [ ] Rate limiting (to be implemented in Vercel/Cloudflare)

---

## 2. Infrastructure Configuration (Environment Variables)

The following variables must be configured in the Vercel/Cloud environment:

| Variable Name | Description | Source |
|---------------|-------------|--------|
| `SUPABASE_URL` | Supabase project URL | Supabase Dashboard |
| `SUPABASE_ANON_KEY` | Public anonymous key | Supabase Dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret service role key (API use only) | Supabase Dashboard |
| `RESEND_API_KEY` | API key for email delivery | Resend Dashboard |
| `KOPOKOPO_API_KEY` | KopoKopo application key | KopoKopo Dashboard |
| `KOPOKOPO_API_SECRET` | KopoKopo application secret | KopoKopo Dashboard |
| `KOPOKOPO_BASE_URL` | `https://api.kopokopo.com` (Prod) | KopoKopo Docs |
| `PUBLIC_DOMAIN` | e.g., `readmartke.com` | Domain Registrar |

---

## 3. Detailed Implementation Plan: KopoKopo API

### Authentication Mechanism
- **Flow:** OAuth 2.0 Client Credentials.
- **Implementation:** `getK2Token()` in [_payments.ts](file:///c:/Users/admin/Desktop/READMART/api/_payments.ts) handles token acquisition and caching (via environment/process memory).

### Required Endpoints
1. **STK Push (M-PESA Express):** `POST /api/v1/incoming_payments`
2. **Payment Status:** `GET /api/v1/incoming_payments/{id}`
3. **Pay Recipient:** `POST /api/v1/pay_recipients` (for author royalties)
4. **B2C Disbursement:** `POST /api/v1/payments`
5. **Webhook Registration:** `POST /api/v1/webhooks`

### Webhook Configuration
- **Endpoint:** `https://<domain>/api/payments?action=webhook`
- **Security:** HMAC-SHA256 signature verification using `KOPOKOPO_API_SECRET`.
- **Events to Handle:**
    - `buygoods_transaction_received`
    - `m-pesa_payment_received`
    - `stk_push_success` / `stk_push_failed`
    - `payment_reversed`

### Data Mapping
- **KopoKopo Payload:** `amount`, `sender_phone`, `reference`, `status`.
- **ReadMart DB:** Maps to `orders` table (status: `paid`, `failed`, `pending`).

---

## 4. Detailed Implementation Plan: Email System

### Provider: Resend
- **API:** Resend Node.js SDK.
- **Configuration:** Initialized in [_email.ts](file:///c:/Users/admin/Desktop/READMART/api/_email.ts).

### Template System
Emails are rendered using React-like templates (or raw HTML templates) in `_email.ts`:
- **Newsletter Confirmation:** Sent when a user joins the mailing list.
- **Order Confirmation:** Sent after successful KopoKopo payment.
- **Failed Payment Alert:** Sent if STK Push fails or is cancelled.
- **Author Application Status:** Sent when an application is approved/rejected.

### Delivery & Tracking
- **Queue Management:** Vercel functions handle immediate sending. For high volume, a queue (e.g., Upstash QStash) is recommended.
- **Tracking:** Resend provides delivery, open, and click-through rates.

---

## 5. Prioritized Development Roadmap

### Phase 1: Security & Stability (High Priority) - *Completed/In Progress*
- [x] PII Protection: Create `public_profiles` view and restrict `profiles` table.
- [x] Realtime Fixes: Refactor dashboard subscriptions and fix replication migrations.
- [x] Linter & Type Safety: Resolve all API and dashboard type errors.
- [ ] **Action:** Apply migrations `20260301000008` and `20260301000009` in Supabase.

### Phase 2: Payment Finalization (Medium Priority) - *2-3 Days*
- [ ] Test STK Push end-to-end in Sandbox.
- [ ] Implement Author Royalty disbursement logic (B2C).
- [ ] Add automatic order status updates via Webhooks.

### Phase 3: Email & Communication (Medium Priority) - *1-2 Days*
- [ ] Configure Resend verified domain.
- [ ] Implement remaining email templates (Author/Partner notifications).
- [ ] Add SMS notification fallback via KopoKopo SMS API.

### Phase 4: Cloud Migration (Low Priority) - *1 Day*
- [ ] Deploy frontend and API to Vercel.
- [ ] Configure environment variables in Vercel Dashboard.
- [ ] Run final UAT (User Acceptance Testing) in production environment.

---

## 6. Testing & Deployment Strategy

### Testing
- **Unit Testing:** API utility functions (signature verification, data mapping).
- **Integration Testing:** Mocking KopoKopo webhook payloads to verify order state transitions.
- **Manual UAT:** Testing the full checkout flow from product selection to payment and email receipt.

### Deployment Procedure
1. Push latest code to `origin`.
2. Apply all pending migrations to the Supabase production DB.
3. Trigger Vercel deployment.
4. Verify environment variables are correctly populated.
5. Monitor logs for any initialization errors.
