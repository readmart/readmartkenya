# ReadMart Platform Maintenance & Backup Guide

This document outlines the procedures for maintaining the ReadMart database and ensuring critical scripts and data are protected.

## 1. Database Backups

### Automated Backups (Supabase)
Supabase automatically performs daily backups of your database. You can restore your database to any point in time (Point-in-Time Recovery) if you are on a Pro or Enterprise plan.

### Manual Backups
Before making significant changes or running raw SQL:
1. Go to the **Supabase Dashboard > Settings > Database**.
2. Scroll to **Backup and Restore**.
3. Use the `pg_dump` tool locally to create a portable backup:
   ```bash
   # Export schema and data
   pg_dump --clean --if-exists --host=db.ywbjykqwohxxgdanzswp.supabase.co --username=postgres --dbname=postgres > backup.sql
   ```

## 2. SQL Script Management

To prevent accidental loss of SQL Editor scripts:
1. **Never treat the SQL Editor as a permanent storage** for critical logic.
2. **Version Control**: All structural changes (tables, functions, triggers) MUST be saved in the `supabase/migrations` directory.
3. **Naming Convention**: Use the `YYYYMMDDHHMMSS_description.sql` format to maintain chronological order.
4. **Testing**: Test all migrations in a local or staging environment before applying to production.

## 3. Disaster Recovery (Partnership System)

If the partnership system tables or logic are deleted:
1. Locate the [recovery_partnership_system.sql](file:///c:/Users/admin/Desktop/READMART/supabase/recovery_partnership_system.sql) file.
2. Copy the contents and run them in the **Supabase SQL Editor**.
3. Run the integrity check script:
   ```bash
   npx tsx scripts/check-db.ts
   ```

## 4. Integrity Checks

Regularly run the database audit script to ensure all core tables and policies are intact:
```bash
npx tsx scripts/check-db.ts
```

## 5. Security Audit

Monthly tasks:
- Verify RLS is enabled on all sensitive tables (`profiles`, `partners`, `agreements`).
- Review admin/founder roles in the `profiles` table to ensure only authorized users have elevated permissions.
- Rotate the `SUPABASE_SERVICE_ROLE_KEY` if it has been exposed.
