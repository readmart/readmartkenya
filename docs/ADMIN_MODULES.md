# ReadMart Administrative Modules Documentation

This document provides a comprehensive technical and functional overview of the administrative modules within the ReadMart Founder Dashboard.

---

<a name="content-management"></a>
## **5. Content Management (Banners, Author of the Day)**

### **5.1 Banners Module**
#### **Purpose**
The Banners module allows administrators to manage promotional imagery and messaging on the platform's landing pages. It provides a way to highlight seasonal sales, new arrivals, or platform-wide announcements.

#### **Functionality**
- **Dynamic Creation**: Uploading images and defining associated headlines and subtext.
- **Link Management**: Assigning internal or external URLs to banners for click-through tracking.
- **Active Toggling**: Instantly enabling or disabling banners without deletion.
- **Metadata Support**: Storing additional configuration like button text or layout preferences.

#### **Data Structures**
**Table: `public.banners`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `title` | `text` | Headline for the banner |
| `content` | `text` | Supporting description or subtext |
| `image_url` | `text` | Link to banner image in Supabase Storage |
| `link_url` | `text` | Target URL when the banner is clicked |
| `is_active` | `boolean` | Flag for public visibility |
| `published_at`| `timestamp`| Scheduled time for banner activation |

#### **API Specifications**
- **Endpoint**: `dashboards.ts -> getAllRecords('banners')`
- **Endpoint**: `dashboards.ts -> updateRecord('banners', id, updates)`
- **Security**: Admins and Founders have full CRUD permissions.

---

### **5.2 Author of the Day Module**
#### **Purpose**
This module is designed to promote community engagement by featuring a specific author and their works on the platform's homepage. It provides high visibility for talented creators and drives sales to their catalog.

#### **Functionality**
- **Author Selection**: Linking a profile from the `profiles` table to the 'Author of the Day' slot.
- **Custom Creative**: Uploading a unique promotional image specifically for the featured slot.
- **Curated Selection**: Picking a subset of the author's books to display alongside their bio.
- **Visibility Control**: Toggling the feature on or off based on editorial needs.

#### **Data Structures**
**Table: `public.site_settings` (Author of the Day Columns)**
| Column | Type | Description |
| :--- | :--- | :--- |
| `author_of_the_day_id` | `uuid` | References `profiles.id` |
| `author_of_the_day_image`| `text` | Custom image URL for the feature |
| `author_of_the_day_books`| `uuid[]`| Array of featured product IDs |
| `author_of_the_day_enabled`| `boolean`| Global toggle for the feature |

#### **API Specifications**
- **Endpoint**: `dashboards.ts -> updateRecord('site_settings', 'global', updates)`
- **Integration**: Homepage fetches these settings via `useSettings` hook or direct Supabase query.

---

<a name="customer-engagement"></a>
## **7. Customer Engagement (Inquiries, Newsletter)**

### **7.1 Newsletter Module**
#### **Purpose**
The Newsletter module manages the platform's subscriber list, enabling marketing outreach and community updates. It ensures compliance with subscription preferences.

#### **Functionality**
- **Subscription Tracking**: Capturing email addresses from the public subscription form.
- **Status Management**: Handling 'active' and 'unsubscribed' states.
- **Batch Operations**: Updating multiple subscriber statuses simultaneously for maintenance.
- **Audit Logging**: Tracking when and how subscription statuses were modified.

#### **Data Structures**
**Table: `public.newsletter_subscriptions`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `email` | `text` | Subscriber's email address |
| `status` | `text` | 'active' or 'unsubscribed' |
| `created_at` | `timestamp`| Date of initial subscription |

#### **API Specifications**
- **Endpoint**: `dashboards.ts -> getNewsletterSubscriptions()`
- **Endpoint**: `dashboards.ts -> updateNewsletterStatus(id, status)`
- **Endpoint**: `dashboards.ts -> batchUpdateNewsletterStatus(ids, status)`

---

### **7.2 Inquiries Module**
#### **Purpose**
The Inquiries module serves as the primary support and communication channel for customers and potential partners. it allows administrators to manage and resolve incoming messages systematically.

#### **Functionality**
- **Status Workflow**: Transitioning inquiries through 'New', 'In Progress', and 'Resolved' states.
- **Department Routing**: Categorizing messages into 'General', 'Order Support', or 'Partnership Inquiry'.
- **Priority Assignment**: Marking urgent messages for immediate attention.
- **Communication Logs**: Tracking responses and resolution timelines.

#### **Data Structures**
**Table: `public.contact_messages`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `full_name` | `text` | Name of the inquirer |
| `email` | `text` | Contact email address |
| `subject` | `text` | Topic of the inquiry |
| `department`| `text` | 'General', 'Order Support', etc. |
| `status` | `text` | 'New', 'In Progress', 'Resolved' |
| `priority` | `text` | 'Low', 'Medium', 'High' |

#### **API Specifications**
- **Endpoint**: `dashboards.ts -> getAllRecords('contact_messages')`
- **Endpoint**: `dashboards.ts -> updateRecord('contact_messages', id, updates)`

---

<a name="community--events"></a>
## **8. Community & Events (Clubs, Events)**

### **8.1 Book Clubs Module**
#### **Purpose**
The Book Clubs module facilitates community building by allowing users to form and manage reading groups. Administrators oversee these clubs to ensure they align with platform guidelines.

#### **Functionality**
- **Club Configuration**: Setting names, descriptions, genres, and meeting frequencies.
- **Privacy Controls**: Toggling between public and private clubs with approval-based membership.
- **Format Management**: Specifying 'Online', 'In-Person', or 'Hybrid' meeting formats.
- **Activity Monitoring**: Tracking active status and member counts.

#### **Data Structures**
**Table: `public.book_clubs`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `name` | `text` | Name of the book club |
| `genre` | `text` | Literary focus (e.g., 'Fiction', 'Sci-Fi') |
| `meeting_format`| `text`| 'Online', 'In-Person', 'Hybrid' |
| `is_public` | `boolean` | Public visibility flag |
| `created_by`| `uuid` | References `profiles.id` (Club Founder) |

#### **API Specifications**
- **Endpoint**: `dashboards.ts -> getAllRecords('book_clubs')`
- **Endpoint**: `dashboards.ts -> updateRecord('book_clubs', id, updates)`

---

### **8.2 Events Module**
#### **Purpose**
The Events module manages both physical and virtual gatherings, such as book launches, author signings, or reading workshops.

#### **Functionality**
- **Event Scheduling**: Setting dates, times, and locations for upcoming activities.
- **RSVP Tracking**: Monitoring community interest and attendance (via linked `event_rsvps`).
- **Media Support**: Uploading promotional imagery for event listings.
- **Lifecycle Management**: Managing events from 'Upcoming' to 'Past'.

#### **Data Structures**
**Table: `public.events`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `title` | `text` | Event name |
| `description`| `text` | Full details of the event |
| `event_date` | `timestamp`| Scheduled date and time |
| `location` | `text` | Physical address or meeting link |
| `is_active` | `boolean` | Public visibility flag |

#### **API Specifications**
- **Endpoint**: `dashboards.ts -> getAllRecords('events')`
- **Endpoint**: `dashboards.ts -> updateRecord('events', id, updates)`

---

<a name="marketing"></a>
## **10. Marketing (Promos)**

### **Purpose**
The Marketing module empowers administrators to create and manage promotional campaigns through discount codes. It drives customer acquisition and retention.

### **Functionality**
- **Code Generation**: Creating unique alphanumeric strings for customer redemption.
- **Discount Logic**: Configuring 'percentage' or 'fixed amount' discounts.
- **Usage Constraints**: Setting minimum order amounts and per-code usage limits.
- **Expiry Controls**: Defining activation and expiration dates for campaigns.

### **Data Structures**
**Table: `public.promos`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `code` | `text` | The redemption string (e.g., 'READ50') |
| `discount_type`| `text` | 'percentage' or 'fixed' |
| `discount_value`| `decimal` | Value of the discount |
| `usage_limit`| `integer` | Maximum times the code can be used |
| `usage_count`| `integer` | Current number of redemptions |
| `expires_at` | `timestamp`| Date when the code becomes invalid |

### **API Specifications**
- **Endpoint**: `dashboards.ts -> getAllRecords('promos')`
- **Endpoint**: `dashboards.ts -> updateRecord('promos', id, updates)`
- **Security**: Promos are publicly viewable by code; management is restricted to Admins.

---

<a name="partnerships"></a>
## **12. Partnerships Module**

### **Purpose**
The Partnerships module manages the ecosystem of external stakeholders, including logistics providers and institutional partners. It tracks their status, performance, and tier-based benefits.

### **Functionality**
- **Tier Management**: Defining partnership levels (Bronze, Silver, Gold) with associated benefits.
- **Profile Management**: Storing company details, logos, websites, and contact info.
- **Featured Partners**: Highlighting key partners on the platform for increased visibility.
- **Role Synchronization**: Automatically updating user roles to 'partner' upon application approval.

### **Data Structures**
**Table: `public.partners`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `company_name`| `text` | Legal name of the partner |
| `tier_id` | `uuid` | References `partnership_tiers.id` |
| `status` | `text` | 'active', 'inactive', 'pending' |
| `website_url` | `text` | Partner's official website |
| `is_featured` | `boolean` | Homepage visibility flag |

**Table: `public.partnership_tiers`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `name` | `text` | Tier name (e.g., 'Gold') |
| `benefits` | `jsonb` | List of perks for this tier |
| `color_code` | `text` | UI representation color |

### **API Specifications**
- **Endpoint**: `dashboards.ts -> getAllRecords('partners')`
- **Endpoint**: `dashboards.ts -> updateApplicationStatus('partnership_applications', id, status)`
- **Security**: Strictly limited to Founders for tier and profile management.

---

<a name="legal--compliance"></a>
## **9. Legal & Compliance (Agreements)**

### **Purpose**
The Agreements module centralizes the management of legal contracts between the platform and its stakeholders (Authors and Partners). It ensures that all participants have reviewed and accepted the terms of service.

### **Functionality**
- **Template Management**: Storage of standard agreement text for different roles.
- **Signing Workflow**: Capturing digital signatures and timestamps upon agreement.
- **Status Tracking**: Monitoring which stakeholders have 'signed', 'pending', or 'expired' agreements.
- **Key Terms Highlighting**: Using JSONB structures to highlight critical clauses for easier review.

### **Data Structures**
**Table: `public.agreements`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `user_id` | `uuid` | References `profiles.id` |
| `type` | `text` | 'author_agreement' or 'partner_agreement' |
| `status` | `text` | 'pending', 'signed', 'expired' |
| `content` | `text` | Full legal text of the agreement |
| `key_terms` | `jsonb` | Structured highlights of important clauses |

### **API Specifications**
- **Endpoint**: `dashboards.ts -> getAgreements()`
- **Endpoint**: `dashboards.ts -> updateRecord('agreements', id, updates)`
- **Security**: 
    - Founders can manage all templates and view all signatures.
    - Users can only view and sign agreements linked to their own `user_id`.

---

<a name="global-logic--settings"></a>
## **5. Global Logic & Settings Module**

### **Purpose**
The Global Logic & Settings module centralizes the configuration of the platform's behavior, branding, and contact information. It allows for rapid updates to site-wide metadata without requiring code deployments.

### **Functionality**
- **Branding Configuration**: Management of site name, logo, and social media links (WhatsApp, etc.).
- **Contact Information**: Centralized storage for email, phone, address, and working hours.
- **Financial Parameters**: Configuration of the platform's tax rate and default currency.
- **System Controls**: Activation of maintenance mode and global operational flags.
- **Analytics aggregation**: Provides the base data for calculating trajectory trends and platform-wide metrics.

### **User Interface Components**
- **Settings Form**: A structured interface for updating text fields, toggles, and image URLs.
- **Analytics Dashboard**: High-level visualization of revenue, order volume, and user growth trends.
- **Maintenance Toggle**: A global switch to restrict platform access during updates.

### **Data Structures**

#### **Table: `public.settings`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `text` | Primary Key (Default: 'global') |
| `site_name` | `text` | Display name of the platform |
| `site_logo` | `text` | URL to the platform logo |
| `whatsapp_link`| `text` | Direct link for customer support |
| `tax_rate` | `decimal` | Global VAT/Tax percentage |
| `maintenance_mode`| `boolean`| Flag to enable/disable site access |

### **API Specifications**
- **Endpoint**: `dashboards.ts -> getGlobalAnalytics()`
- **Endpoint**: `dashboards.ts -> updateRecord('settings', 'global', updates)`
- **Security**: 
    - Settings are publicly viewable for branding purposes.
    - Updates are strictly limited to Founders and Admins.

---

<a name="shipping--logistics"></a>
## **6. Shipping & Logistics Module**

### **Purpose**
The Shipping & Logistics module manages the geographic coverage and delivery costs for the platform. It enables precise control over shipping zones, surcharges, and estimated delivery timelines.

### **Functionality**
- **Zone Management**: Defining delivery areas (e.g., 'Nairobi Central', 'Mombasa CBD').
- **Dynamic Pricing**: Setting base rates and weight/volume-based surcharges for each zone.
- **Delivery Estimations**: Configuring expected delivery days per geographic area.
- **Partner Assignment**: Linking shipping zones to specific logistics partners for automated order routing.
- **Status Automation**: Automatic status transitions based on fulfillment ledger updates.

### **User Interface Components**
- **Shipping Zone List**: A directory of active and inactive delivery areas.
- **Zone Editor**: Modal for configuring price, surcharges, and estimated delivery days.
- **Partner Mapping**: Interface to assign zones to registered logistics partners.

### **Data Structures**

#### **Table: `public.shipping_zones`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `name` | `text` | Name of the area or town |
| `price` | `decimal` | Base shipping rate for the zone |
| `weight_surcharge`| `decimal` | Additional cost per unit weight |
| `estimated_days`| `integer` | Expected time for delivery |
| `partner_id` | `uuid` | References logistics partner in `profiles` |

### **API Specifications**
- **Endpoint**: `dashboards.ts -> getShippingZones()`
- **Endpoint**: `dashboards.ts -> updateRecord('shipping_zones', id, updates)`
- **Security**: 
    - Shipping zones are publicly viewable during checkout.
    - Management is limited to Admins and Founders.

---

<a name="users--identity"></a>
## **3. Users & Identity Module**

### **Purpose**
The Users & Identity module manages the platform's user base, ensuring secure access and appropriate role assignments. It bridges the gap between Supabase Authentication and application-level profiles.

### **Functionality**
- **Profile Management**: Storage of user metadata (full name, bio, avatar, contact info).
- **Role-Based Access Control (RBAC)**: Assignment and enforcement of user roles ('customer', 'author', 'partner', 'admin', 'founder').
- **Audit Tracking**: Linking system actions to specific administrative or user identities.
- **Account Security**: Integration with Supabase Auth for password management and secure sessions.

### **User Interface Components**
- **User Directory**: List of all registered users with role filtering.
- **Profile Editor**: Admin interface to modify user roles and update profile information.
- **Role Badges**: Visual indicators of a user's current platform permissions.

### **Data Structures**

#### **Table: `public.profiles`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key (Linked to `auth.users`) |
| `full_name` | `text` | User's display name |
| `email` | `text` | Primary contact email |
| `role` | `text` | Permissions tier (customer, admin, etc.) |
| `avatar_url` | `text` | Link to profile image in storage |
| `bio` | `text` | Brief description (primarily for Authors) |

### **API Specifications**
- **Endpoint**: `dashboards.ts -> getAllUsers()`
- **Endpoint**: `dashboards.ts -> updateRecord('profiles', id, updates)`
- **Security**: 
    - Profile viewing is public for basic info.
    - Role modification is strictly limited to Founders.
    - Automated role updates occur upon Agreement approval.

---

<a name="infrastructure"></a>
## **4. Infrastructure & Communications Module**

### **Purpose**
This module provides the underlying auditability and communication logs for the platform. it ensures that all critical actions are tracked and that system-to-user communications are reliable.

### **Functionality**
- **Audit Logging**: Capturing administrative actions (status changes, record deletions).
- **Notification Logs**: Tracking outgoing emails (abandoned cart, order confirmation, payout alerts).
- **Realtime Replication**: Enabling live updates for dashboard metrics.
- **Schema Resilience**: Backend logic to handle database schema mismatches without UI crashes.

### **Data Structures**

#### **Table: `public.audit_logs`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `user_id` | `uuid` | The actor who performed the action |
| `action` | `text` | Description of action (e.g., 'update_order_status') |
| `resource` | `text` | The table or module affected |
| `metadata` | `jsonb` | Snapshot of changes made |

#### **Table: `public.notification_logs`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `recipient` | `text` | Target email address |
| `subject` | `text` | Email subject line |
| `status` | `text` | 'pending', 'sent', or 'failed' |
| `error_message` | `text` | Details if the communication failed |

### **API Specifications**
- **Endpoint**: `dashboards.ts -> getAuditLogs()`
- **Utility**: `api-helpers.ts -> logAudit(action, resource, metadata)`
- **Security**: 
    - Audit and communication logs are visible only to Admins and Founders.
    - Logs are immutable (no DELETE/UPDATE endpoints exposed).

---

## **Table of Contents**
1. [Orders](#orders)
2. [Payouts](#payouts)
3. [Users & Identity](#users--identity)
4. [Global Logic & Settings](#global-logic--settings)
5. [Content Management (Banners, Author of the Day)](#content-management)
6. [Shipping & Logistics](#shipping--logistics)
7. [Customer Engagement (Inquiries, Newsletter)](#customer-engagement)
8. [Community & Events (Clubs, Events)](#community--events)
9. [Legal & Compliance (Agreements)](#legal--compliance)
10. [Marketing (Promos)](#marketing)
11. [Infrastructure (Communications, Audit Logs)](#infrastructure)
12. [Partnerships](#partnerships)

---

<a name="orders"></a>
## **1. Orders Module**

### **Purpose**
The Orders module is the central hub for managing customer purchases, tracking fulfillment status, and ensuring financial reconciliation. It allows administrators and partners to monitor the complete lifecycle of an order from placement to delivery.

### **Functionality**
- **Order Tracking**: Real-time monitoring of order status (Pending, Processing, Shipped, Delivered, Cancelled).
- **Payment Verification**: Confirmation of payment status (is_paid) synced with M-Pesa/Stripe webhooks.
- **Fulfillment Management**: Assignment of orders to shipping zones and partners.
- **Detailed View**: Access to customer details, shipping addresses, and individual line items.
- **Analytics**: Integration with the global analytics engine for revenue and volume reporting.

### **User Interface Components**
- **Order List**: A sortable, filterable table displaying order ID, customer name, total amount, status, and creation date.
- **Status Badges**: Color-coded indicators for quick status identification.
- **Order Details Modal**: Detailed breakdown of items, shipping address, financial split (tax, shipping, subtotal), and status history.

### **Data Structures**

#### **Table: `public.orders`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `user_id` | `uuid` | References `profiles.id` |
| `status` | `text` | Current state (e.g., 'pending', 'processing', 'completed') |
| `total_amount` | `decimal` | Total amount paid by the customer |
| `shipping_amount`| `decimal` | Cost of delivery |
| `tax_amount` | `decimal` | Calculated tax (VAT) |
| `is_paid` | `boolean` | Payment verification status |
| `shipping_address`| `jsonb` | Snapshot of customer's delivery information |
| `shipping_zone_id`| `uuid` | References `shipping_zones.id` |

#### **Table: `public.order_items`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `order_id` | `uuid` | References `orders.id` |
| `product_id` | `uuid` | References `products.id` |
| `quantity` | `integer` | Number of items purchased |
| `price_at_purchase`| `decimal` | Unit price at the time of order |
| `product_snapshot` | `jsonb` | Full product data at time of purchase |

### **API Specifications**
- **Endpoint**: `dashboards.ts -> getOrders(partnerId?: string)`
- **Request**: Optional `partnerId` for filtered access.
- **Response**: Array of `Order` objects with joined `profiles` and `order_items`.
- **Security**: 
    - Founders/Admins can fetch all orders.
    - Partners can only fetch orders where `shipping_zone_id` matches zones assigned to them.

---

<a name="payouts"></a>
## **2. Payouts Module**

### **Purpose**
The Payouts module manages the distribution of earnings to Authors and Partners. It tracks commissions, fixed fees, and processing fees to ensure transparent financial operations.

### **Functionality**
- **Ledger Tracking**: Automated recording of every financial transaction related to fulfillment.
- **Earnings Calculation**: Real-time balance updates for Authors based on book sales.
- **Payout Requests**: Interface for Authors/Partners to request withdrawals to M-Pesa or bank accounts.
- **Approval Workflow**: Founder interface to approve, reject, or process payout requests.
- **Payment Method Management**: Secure storage of disbursement details (M-Pesa numbers, etc.).

### **User Interface Components**
- **Earnings Dashboard**: Displays total earnings, current balance, and pending payouts.
- **Transaction History**: List of all ledger entries with linked order details.
- **Withdrawal Form**: Interface to select payment method and specify withdrawal amount.
- **Admin Payout Queue**: Centralized list of all pending payout requests across the platform.

### **Data Structures**

#### **Table: `public.fulfillment_ledger`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `uuid` | Primary Key |
| `order_id` | `uuid` | References `orders.id` |
| `partner_id` | `uuid` | References `profiles.id` (Partner or Author) |
| `amount` | `decimal` | Net amount for the stakeholder |
| `payout_status` | `text` | 'pending', 'paid', or 'failed' |
| `metadata` | `jsonb` | Details on commission rates or fees applied |

#### **Table: `public.author_earnings`**
| Column | Type | Description |
| :--- | :--- | :--- |
| `author_id` | `uuid` | Primary Key (References `profiles.id`) |
| `total_earnings` | `decimal` | Lifetime earnings |
| `current_balance` | `decimal` | Available funds for withdrawal |

### **API Specifications**
- **Endpoint**: `dashboards.ts -> getPartnerPayouts(partnerId: string)`
- **Endpoint**: `dashboards.ts -> requestAuthorPayout(authorId: string, amount: number, details: any)`
- **Security**: 
    - Role-based verification (Partner, Author, Admin).
    - Edge Function `/functions/v1/payments/author-payout` handles the actual disbursement logic.

---
