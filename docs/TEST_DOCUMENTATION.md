# **READMART FOUNDER DASHBOARD: TEST DOCUMENTATION**

## **1. Overview**
This document outlines the testing strategy, test cases, and validation rules for the ReadMart Founder Dashboard. The goal is to ensure system stability, data integrity, and security across all administrative modules.

---

## **2. Testing Strategy**
The system employs a multi-layered testing approach:
- **Unit Tests**: Verifying individual API functions and utility logic.
- **Integration Tests**: Testing the interaction between the frontend, Supabase API, and Edge Functions.
- **Security Tests**: Verifying Row Level Security (RLS) and Role-Based Access Control (RBAC).
- **Validation Rules**: Ensuring data integrity at the application and database levels.

---

## **3. Test Cases by Module**

### **3.1 Orders & Payments**
| Test Case ID | Description | Expected Result |
| :--- | :--- | :--- |
| ORD-01 | Create a new order with valid items. | Order created, subtotal/tax/total calculated correctly via DB trigger. |
| ORD-02 | Update order status to 'shipped'. | Status updated in DB, audit log created. |
| ORD-03 | Initiate M-Pesa payment (STK Push). | K2 API called, payment record created in 'pending' status. |
| ORD-04 | Simulate payment webhook success. | Order status updated to 'paid' automatically. |
| ORD-05 | Attempt to view orders as a non-admin. | API returns 403/Unauthorized; RLS blocks data retrieval. |

### **3.2 User & Identity Management**
| Test Case ID | Description | Expected Result |
| :--- | :--- | :--- |
| USR-01 | Fetch all user profiles as an Admin. | Returns full list with PII (email, phone). |
| USR-02 | Toggle 'is_active' status for a user. | User is blocked from logging in/performing actions. |
| USR-03 | Attempt to change own role to 'founder'. | Request rejected by RLS (only founders can promote to founder). |

### **3.3 Content Management (Banners, CMS)**
| Test Case ID | Description | Expected Result |
| :--- | :--- | :--- |
| CMS-01 | Upload a banner image. | File stored in 'banners' bucket, URL saved to DB. |
| CMS-02 | Delete a product with an ebook file. | DB record removed, ebook file deleted from storage. |
| CMS-03 | Update global site settings. | Changes reflected site-wide immediately. |

---

## **4. Data Validation Rules**

### **4.1 Product Input**
- **Title**: Required, min 3 chars.
- **Price**: Required, must be a positive decimal.
- **Stock Quantity**: Integer, minimum 0.
- **Slug**: Unique, URL-friendly format.

### **4.2 Shipping & Logistics**
- **Phone Number**: Must follow Kenyan format (+254...).
- **Shipping Zone**: Must be selected from existing zones.
- **Amount**: Automatically calculated based on zone and subtotal.

---

## **5. Security & RBAC Verification**

### **5.1 RLS Audit**
Every table must have RLS enabled. Verification steps:
1. Log in as a 'User'.
2. Attempt to `SELECT * FROM public.audit_logs`.
3. **Pass Criteria**: Zero results returned or 403 error.

### **5.2 API Verification**
All admin functions in `dashboards.ts` must call `verifyAdmin()` or `verifyAuthor()`.
- **Test**: Remove the `verifyAdmin()` call and attempt to fetch data.
- **Pass Criteria**: Frontend should handle the error gracefully, but backend must block the request.

---

## **6. Schema Resilience Tests**

### **6.1 Column Missing Scenario**
- **Scenario**: A new column `discount_type` is expected by the UI but missing in the DB.
- **Test**: Call `getPromos()`.
- **Expected Result**: The `withRetry` logic should catch the PGRST204 error, filter the query, and return the data without the missing column instead of crashing.

---

## **7. Automated Test Suite**
Tests are located in `src/api/__tests__/` and run using Vitest.
- **Run all tests**: `npm test`
- **Run specific file**: `npm test analytics_engine.test.ts`
