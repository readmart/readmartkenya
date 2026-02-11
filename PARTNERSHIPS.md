# ReadMart Partnerships System

This document outlines the architecture, API specifications, and user guides for the ReadMart Partnerships system.

## Overview

The partnership system is designed to manage a global ecosystem of collaborators, including logistics providers, publishers, technology partners, and local hubs. It features a multi-tiered progression system (Bronze, Silver, Gold) and a formal application/agreement workflow.

## Core Components

### 1. Database Schema
- `partnership_tiers`: Defines levels of partnership with associated benefits and requirements.
- `partners`: Stores approved partner profiles linked to user accounts.
- `partnership_applications`: Tracks the lifecycle of a partnership request.
- `partnership_agreements`: Templates for legal protocols between ReadMart and partners.

### 2. Public Interface
- `/partnerships`: Directory of active partners with search and category filtering.
- `/partnership/apply`: Formal application portal with file upload for qualification proof.

### 3. Admin Interface (Founder Dashboard)
- **Agreements View**: Manage application workflow (Pending -> Agreement Sent -> Activating -> Completed).
- **Partnership Manager**: CRUD operations for tiers and direct management of partner profiles.

## API Specifications

### Applications API (`/api/applications`)

#### POST (Submit Application)
- **Body**:
  ```json
  {
    "type": "partner",
    "full_name": "string",
    "email": "string",
    "organization": "string",
    "service_type": "string",
    "description": "string",
    "proof_url": "string"
  }
  ```
- **Action**: Creates record in `partnership_applications`, sends notification to `partners@readmartke.com`.

#### PUT (Update Status)
- **Query**: `id` (application ID)
- **Body**: `{ "status": "string" }`
- **Statuses**: `pending`, `agreement_sent`, `agreement_confirming`, `activating`, `completed`, `rejected`.
- **Side Effect**: When status is set to `completed`, the user's role is updated to `partner` and a profile is created in the `partners` table.

### Partnerships API (`/api/partnerships`)
- `getPartners()`: Returns active partners with tier info.
- `getPartnershipTiers()`: Returns active tiers.
- `managePartner(id, data)`: Upserts partner profiles.

## User Guide for Admins

### Reviewing Applications
1. Navigate to **Founder Dashboard** > **Agreements**.
2. Filter by "Partner Applications".
3. Review the provided organization details and qualification proof.
4. Use "Send Agreement" to trigger the legal workflow.
5. Once the signed agreement is verified, update status to "Completed" to activate the partner account.

### Managing Partner Profiles
1. Navigate to **Founder Dashboard** > **Partnerships**.
2. Edit existing partners to update their "Featured" status, tier, or contact information.
3. Manage Tiers to adjust benefits as the ecosystem scales.

## SEO and Discoverability
- **Meta Tags**: Optimized with `react-helmet-async` for social sharing and search ranking.
- **Structured Data**: JSON-LD schema (Schema.org) implemented for "Organization" and "WebPage" types to enhance search engine results.
- **Semantic HTML**: Using proper header hierarchy (`h1`-`h6`) and sectioning.

## Performance Optimization
- **Lazy Loading**: Partner logos use `loading="lazy"` and explicit dimensions to prevent Layout Shift (CLS).
- **Memoized Filtering**: Search and category filtering use `useMemo` for sub-millisecond responsiveness.
- **Page Load**: Targeted load time < 3s through optimized assets and minimal runtime overhead.

## Accessibility (WCAG 2.1 AA)
- **ARIA Roles**: Interactive elements use `role="list"`, `role="listitem"`, and `aria-label`.
- **Keyboard Navigation**: All interactive elements are focusable and navigable via keyboard.
- **Screen Readers**: `sr-only` text used for descriptive section titles and decorative elements hidden with `aria-hidden`.

## Analytics Events
The system tracks the following events via `@vercel/analytics`:
- `page_view_partnerships`: Tracked on `/partnerships`.
- `click_become_partner_hero`: When a user clicks the CTA in the hero section.
- `partnership_search`: When a user searches for a partner.
- `filter_partners`: When a user filters by category.
- `partnership_application_submit`: On successful form submission.
- `partnership_file_upload`: When a user uploads qualification proof.
