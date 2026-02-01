# Investigation and Plan: Finalizing Codebase Edits

## 1. Assessment of Current State

### **Technical Summary**
The codebase has undergone significant stabilization, but several runtime errors persist due to "Schema Cache Drift" and "Column Mismatch" between the frontend queries and the Supabase/PostgREST database schema.

### **Current Issues Identified**
1.  **Profiles Query 400 Error**: Despite removing the `bio` column, the query for `profiles` still fails. Investigation suggests that `phone` and `address` columns are missing from the `profiles` table in the database.
2.  **Site Settings Query 400 Error**: The `useSettings` hook requests 28 columns, many of which (e.g., `tax_rate`, `membership_wall_active`, `author_of_the_day_enabled`) are missing from the `site_settings` table.
3.  **Checkout Sessions 404/PGRST205 Error**: The `checkout_sessions` table is not found in the schema cache, causing a 404 error during checkout. This persists even after migrations are applied, indicating a severe cache drift issue.
4.  **Schema Cache Latency**: PostgREST sometimes fails to detect new columns or tables even after migrations are applied, requiring a manual `NOTIFY pgrst, 'reload schema'` or a database restart.
5.  **Browser Port Disconnection**: Console warnings about `Attempting to use a disconnected port object` are likely due to browser extensions (e.g., Google Translate) and do not impact application stability, though they clutter the logs.

### **Edits Assessment**
-   **AuthContext.tsx**: Updated to remove `bio`, but still requesting potentially non-existent `phone`/`address`.
-   **Checkout.tsx**: Hardened with `.maybeSingle()` to prevent hard crashes during schema drift.
-   **useSettings.ts**: Contains a very broad query that is currently failing.

---

## 2. Specific Action Items

### **High Priority (Immediate)**
- [ ] **Fix Profiles Schema**: Add `phone` and `address` columns to the `profiles` table via a new migration.
- [ ] **Fix Site Settings Schema**: Create a comprehensive migration to add all 14+ missing columns to `site_settings` (tax_rate, membership fields, author_of_the_day fields).
- [ ] **Verify Checkout Sessions**: Ensure the `checkout_sessions` table is not just defined in migrations but physically exists and is accessible. Force a schema reload if necessary.
- [ ] **Align Frontend Queries**: Update `AuthContext.tsx`, `useSettings.ts`, and `Checkout.tsx` to use safe fallback logic and ensure they only request columns that are guaranteed to exist.

### **Medium Priority**
-   [ ] **Implement Schema Reload Trigger**: Ensure all migrations end with `NOTIFY pgrst, 'reload schema';`.
-   [ ] **Database Audit**: Run a script to verify that all tables defined in migrations actually exist in the production schema.

---

## 3. Implementation Timeline

| Phase | Task | Duration |
| :--- | :--- | :--- |
| **Phase 1: Database Alignment** | Create and apply emergency schema synchronization migrations. | 1 Hour |
| **Phase 2: Frontend Hardening** | Update hooks and contexts with robust error handling and fallback queries. | 1 Hour |
| **Phase 3: Verification** | Run diagnostic scripts and manual end-to-end testing of checkout/profile flows. | 1 Hour |

---

## 4. Quality Checkpoints
1.  **No 400 Errors**: Browser console must be clear of "Bad Request" errors during initial load and login.
2.  **Successful Checkout**: The `checkout_sessions` table must be successfully populated upon entering the checkout flow.
3.  **Profile Completeness**: User profile data (including phone/address) must be editable and persistable.
4.  **Settings Resilience**: The app must load with default settings if the database fetch fails, without showing a white screen.

---

## 5. Success Criteria for Finalizing Edits
-   [ ] All known 400 (Bad Request) errors in the logs are resolved.
-   [ ] `git status` shows no uncommitted changes in core logic files.
-   [ ] All migrations are successfully applied to the target database.
-   [ ] The application passes a full "Happy Path" test: Login -> Add to Cart -> Checkout -> Profile Update.

---

## 6. Manual Intervention (If Automation Fails)
If you continue to see `PGRST205` or `404 (Not Found)` errors for the `checkout_sessions` table, follow these steps in your Supabase Dashboard:

1.  **Open SQL Editor**: Go to the "SQL Editor" tab in Supabase.
2.  **Run Schema Reload**: Execute the following command:
    ```sql
    NOTIFY pgrst, 'reload schema';
    ```
3.  **Verify Table Existence**: If step 2 doesn't work, ensure the table exists by running:
    ```sql
    SELECT * FROM checkout_sessions LIMIT 1;
    ```
    If this fails, the table was not created. Run the migration manually or contact support.

---

**Prepared by**: Trae Code Assistant
**Date**: 2026-02-01
