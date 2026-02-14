# **READMART FOUNDER DASHBOARD: TECHNICAL SPECIFICATIONS**

## **1. Introduction**
This document provides technical details for the ReadMart Founder Dashboard, including API specifications, database schemas, integration points, and security models. It is intended for developers maintaining or extending the system.

---

## **2. Architecture Overview**
- **Frontend**: React (Vite), Tailwind CSS, Lucide Icons.
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions).
- **State Management**: React Hooks (Context/State).
- **API Layer**: Centralized API functions in `src/api/` with schema resilience logic.

---

## **3. API Endpoint Specifications**

### **3.1 General CRUD Utilities**
The dashboard uses generic utilities for most administrative tasks to ensure consistency and built-in audit logging.

| Function | Parameters | Purpose |
| :--- | :--- | :--- |
| `createRecord` | `(table: string, record: any)` | Inserts a new record into the specified table with schema fallback and audit logging. |
| `updateRecord` | `(table: string, id: string, updates: any)` | Updates an existing record with schema mismatch recovery and audit logging. |
| `deleteRecord` | `(table: string, id: string)` | Deletes a record and performs storage cleanup (if applicable) and audit logging. |
| `deleteRecords` | `(table: string, ids: string[])` | Bulk deletes multiple records. |

### **3.2 Specialized Module APIs**

#### **Orders & Payouts**
- **File**: `src/api/dashboards.ts` & `src/api/payments.ts`
- `getOrders()`: Fetches all orders with item details and status history.
- `updateOrderStatus(orderId, status)`: Updates order status and triggers notifications.
- `checkPaymentStatus(orderId)`: Verifies M-Pesa payment status via K2 integration.
- `getAllPayouts()`: Fetches payment disbursements for authors and partners.

#### **User & Identity Management**
- **File**: `src/api/dashboards.ts`
- `getAllUsers()`: Returns all user profiles with role and status information.
- `updateUserStatus(userId, isActive)`: Enables/disables user access.
- `verifyAdmin()`: Middleware-like check to ensure the user has 'admin' or 'founder' role.

#### **Content Management (Banners, Authors, CMS)**
- **File**: `src/api/dashboards.ts`
- `createBanner(banner)` / `updateBanner(id, updates)`: Manages promotional banners.
- `createAnnouncement(announcement)`: Manages site-wide top-bar announcements.
- `updateSiteSettings(settings)`: Updates global configuration (site name, logo, social links).

---

## **4. Database Schema**

### **4.1 Core Tables**

#### **Profiles (`public.profiles`)**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key (Auth UID) |
| `email` | TEXT | User email |
| `full_name` | TEXT | User's display name |
| `role` | TEXT | 'user', 'author', 'admin', 'founder' |
| `is_active` | BOOLEAN | Account status |
| `bio` | TEXT | Author biography |

#### **Orders (`public.orders`)**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `user_id` | UUID | FK to profiles |
| `status` | TEXT | 'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled' |
| `total_amount` | DECIMAL | Total order cost including tax and shipping |
| `payment_status` | TEXT | 'pending', 'received', 'failed' |
| `shipping_address` | JSONB | Recipient name, phone, town, and address |
| `shipping_zone_id` | UUID | FK to shipping_zones |

#### **Site Settings (`public.site_settings`)**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | TEXT | Primary Key (Default: 'global') |
| `site_name` | TEXT | ReadMart brand name |
| `tax_rate` | DECIMAL | Global VAT rate (Default: 16%) |
| `membership_price` | DECIMAL | Cost of premium membership |
| `maintenance_mode` | BOOLEAN | Global site access toggle |

---

## **5. Role-Based Access Control (RBAC)**

ReadMart uses a hierarchical role system enforced via Supabase Row Level Security (RLS) and frontend API verification.

| Role | Access Level | Permissions |
| :--- | :--- | :--- |
| **Founder** | Super Admin | Full access to all modules, financial data, and system settings. |
| **Admin** | Management | Full access to most modules (Orders, Users, Content). Restricted on core system settings. |
| **Author** | Contributor | Access to their own products, inventory, and payout history. No access to other users' data. |
| **User** | Customer | Access to personal profile, own orders, and public content. |

### **RLS Example (Promos Table)**
```sql
CREATE POLICY "Admins can manage all promos" ON public.promos
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'founder'))
    );
```

---

## **6. Integration Points**

### **6.1 Payment Gateway (K2 / M-Pesa)**
- **Type**: REST API Integration.
- **Workflow**:
  1. Frontend calls `initiatePayment`.
  2. Backend triggers K2 STK Push.
  3. K2 sends webhook to Supabase Edge Function.
  4. Edge Function updates `orders.payment_status` and `orders.status`.
- **Webhooks**: Registered via `registerWebhooks()` in `payments.ts`.

### **6.2 Storage (Supabase Storage)**
- **Buckets**:
  - `products`: Product cover images.
  - `ebooks`: Digital book files (PDF/EPUB).
  - `banners`: CMS promotional graphics.
- **Cleanup**: `deleteProduct` API automatically triggers storage deletion for associated files.

---

## **7. Schema Resilience & Error Handling**

To prevent dashboard crashes due to database schema mismatches (e.g., missing columns during migrations), the API layer implements a **Retry & Filter** pattern.

### **Mechanism: `withRetry` Wrapper**
```typescript
// Example from dashboards.ts
if (error.code === 'PGRST204') { // Column not found
  const missingCol = extractMissingColumn(error.message);
  delete payload[missingCol]; // Remove problematic field
  throw error; // Trigger retry without the missing column
}
```

---

## **8. Realtime Replication**
Realtime is enabled for critical tables to ensure the dashboard reflects live updates without page refreshes:
- `orders`
- `inquiries`
- `newsletter_subscriptions`
- `profiles`

To enable for a new table:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE table_name;
```

---

## **9. Audit Logging**
Every write operation (CREATE, UPDATE, DELETE) is logged in the `audit_logs` table via the `logAudit` helper.
- **Data Captured**: Actor UID, Action Type, Table Name, Record ID, New Data, and Old Data (for diffing).
