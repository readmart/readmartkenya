# ReadMart Serverless Functions Documentation

This document describes the 12 serverless functions maintained in the ReadMart system. All functions are deployed on Vercel and use the Node.js runtime.

## General Configuration
- **Runtime**: Node.js 20.x
- **Base Path**: `/api`
- **Region**: Automatically managed by Vercel
- **Memory**: 1024MB (Default)

## Function List

### 1. Auth (`/api/auth`)
- **Action**: `create-session` (POST), `verify-session` (GET)
- **Description**: Manages JWT-based user sessions and verification.
- **Security**: Uses HS256 algorithm with `VITE_JWT_SECRET`.

### 2. Payments (`/api/payments`)
- **Endpoints**: `/api/payments/init`, `/api/payments/webhook`, `/api/payments/status`
- **Description**: Integrates with Kopo Kopo payment gateway for STK Push and webhooks.
- **Security**: Signature verification for all webhooks.

### 3. Orders (`/api/orders`)
- **Methods**: POST (Create), GET (Retrieve)
- **Description**: Handles order creation and retrieval from Supabase.
- **Integration**: Triggers commission calculations on successful payment.

### 4. Applications (`/api/applications`)
- **Methods**: POST (Submit), PUT (Update)
- **Description**: Manages author and partner application workflows.
- **Notifications**: Sends email notifications to admins and applicants.

### 5. Reminders (`/api/reminders`)
- **Method**: POST (Trigger)
- **Description**: Identifies abandoned carts and sends email reminders.
- **Trigger**: Intended to be called by a cron job (e.g., Vercel Cron).

### 6. Contact (`/api/contact`)
- **Method**: POST
- **Description**: Processes contact form submissions and notifies support.

### 7. Newsletter (`/api/newsletter`)
- **Methods**: POST (Subscribe), GET (List)
- **Description**: Manages newsletter subscriptions.

### 8. Products (`/api/products`)
- **Method**: GET
- **Description**: Provides an API for fetching products with filtering and featured status.

### 9. Community (`/api/community`)
- **Method**: GET
- **Description**: Fetches book club details and discussion threads.

### 10. Dashboards (`/api/dashboards`)
- **Method**: GET
- **Description**: Aggregates statistics for Founder, Partner, and Author dashboards.
- **Security**: Role-based access control (RBAC).

### 11. Ebooks (`/api/ebooks`)
- **Method**: GET (Action: `get-access`)
- **Description**: Verifies purchase history and provides access to digital content.

### 12. Health (`/api/health`)
- **Method**: GET
- **Description**: Automated health check for system status and database connectivity.

## Maintenance and Monitoring
- **Logging**: All critical actions are logged to the `audit_logs` table in Supabase.
- **Errors**: Errors are caught and returned as JSON with 500 status, also logged to Vercel Logs.
- **CI/CD**: Automatic deployments on git push to `main` branch.
- **Security**: Regular dependency checks via `npm audit`.

## Testing
- **Health Check**: Monitor `/api/health` for uptime.
- **Load Testing**: A local test script is available at `scripts/load-test.ts`. Run it with `tsx scripts/load-test.ts [URL] [CONCURRENCY] [DURATION]`.
- **Pressure Testing**: Recommended using tools like k6 or Artillery on a staging environment for more comprehensive analysis.
