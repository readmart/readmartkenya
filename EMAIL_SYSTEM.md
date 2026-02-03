# ReadMart Email System Documentation

This document describes the email delivery and tracking system implemented for ReadMart using Resend.

## Core Components

### 1. Email Templates (`api/_email.ts`)
All email templates are defined in `api/_email.ts`. They use a consistent branding wrapper `wrapEmailTemplate` which provides:
- Responsive design for mobile and desktop.
- Consistent header with ReadMart logo.
- Footer with useful links and copyright.
- Preview text support for email clients.

**Available Templates:**
- `renderContactNotificationEmail`: For contact form inquiries.
- `renderFailedPaymentEmail`: Sent when an M-Pesa transaction fails.
- `renderAbandonedCartEmail`: Reminder for users with items in their cart.
- `renderApplicationNotificationEmail`: Internal notification for author/partner applications.
- `renderApplicationStatusEmail`: Approval/rejection notification for applicants.
- `renderAgreementNotificationEmail`: Notification when legal agreements are ready.
- `renderActivationNotificationEmail`: Welcome email after account activation.
- `renderOrderConfirmationEmail`: Detailed order receipt with e-book access info.
- `renderNewsletterConfirmationEmail`: Double opt-in confirmation for newsletter.

### 2. Delivery Engine (`api/_email.ts`)
The `sendEmail` function handles the actual transmission via Resend API.
- **Logging**: Every email attempt is logged to `notification_logs`.
- **Retries**: Implements exponential backoff (up to 3 attempts) for rate limits or server errors.
- **Error Handling**: Captures and logs API errors for troubleshooting.

### 3. Delivery Tracking (`api/emails.ts`)
A webhook endpoint at `/api/emails` receives events from Resend (via Svix).
- **Events Tracked**: `sent`, `delivered`, `opened`, `clicked`, `bounced`, `complained`.
- **Persistence**: Updates the `notification_logs` table with `delivery_status`, `opened_at`, and `clicked_at`.

### 4. Database Schema
The `notification_logs` table stores the history of all outgoing communications:
- `recipient`: Email address of the receiver.
- `subject`: Email subject line.
- `status`: Current status (`pending`, `sent`, `failed`).
- `resend_id`: The unique ID assigned by Resend (used for webhook matching).
- `delivery_status`: Detailed delivery status from webhooks.
- `opened_at`: Timestamp of the first open event.
- `clicked_at`: Timestamp of the first click event.
- `metadata`: Additional context (sender info, raw API responses).

## Integration Guide

### Environment Variables
The following variables must be set:
- `RESEND_API_KEY`: Your Resend API key.
- `EMAIL_FROM`: Default sender address (e.g., `ReadMart <no-reply@readmartke.com>`).
- `PUBLIC_DOMAIN`: Domain for generating links (e.g., `readmartke.com`).

### Webhook Configuration
In the Resend Dashboard, configure a webhook pointing to:
`https://your-domain.com/api/emails`

Select the following events:
- Email Sent
- Email Delivered
- Email Opened
- Email Clicked
- Email Bounced
- Email Complained

## Testing
A test script is available at `scripts/test-email-webhook.js` to simulate Resend webhook events during development.
