# Partnership Management API Documentation

This document outlines the API infrastructure for managing partnerships, tiers, and partner profiles in the ReadMart ecosystem.

## Overview

The partnership system is built on Supabase with Row Level Security (RLS) and Zod validation. It supports public directory listing and administrative management.

## Endpoints (Client-Side API)

### Public Endpoints

#### `getPartnershipTiers()`
- **Description**: Fetches all active partnership tiers ordered by display priority.
- **Access**: Public
- **Return**: `Promise<PartnershipTier[]>`

#### `getPartners()`
- **Description**: Fetches all active partners with their associated tier information.
- **Access**: Public
- **Return**: `Promise<PartnerProfile[]>`

### Administrative Endpoints (Admin/Founder Only)

#### `createPartnershipTier(tierData)`
- **Description**: Creates a new partnership tier.
- **Validation**: `partnershipTierSchema` (Zod)
- **Security**: Verifies admin role and logs audit trail.

#### `updatePartnershipTier(id, tierData)`
- **Description**: Updates an existing tier.
- **Security**: Verifies admin role and logs audit trail.

#### `managePartner(id, partnerData)`
- **Description**: Unified function to create or update partner profiles.
- **Security**: Verifies admin role.

#### `deletePartnershipTier(id)`
- **Description**: Deletes a tier (use with caution).

## Database Schema

### `partnership_tiers`
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary Key |
| name | TEXT | Tier name (Gold, Silver, etc) |
| color_code | TEXT | Hex code for UI branding |
| benefits | JSONB | List of benefits strings |
| is_active | BOOL | Toggle visibility |

### `partners`
| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary Key |
| user_id | UUID | Link to profiles table |
| tier_id | UUID | Link to partnership_tiers |
| company_name| TEXT | Display name |
| status | TEXT | active, inactive, pending |

## Security Best Practices

1. **Row Level Security**: All tables have RLS enabled. Public can only `SELECT` active records. `INSERT/UPDATE/DELETE` requires admin role verification via `verifyAdmin()` helper.
2. **Data Validation**: Every write operation is validated using Zod schemas to ensure data integrity.
3. **Audit Logging**: All administrative changes to tiers are logged via the `logAudit` helper for traceability.
4. **Input Sanitization**: Select inputs and text areas are handled via controlled components and validated before database submission.
