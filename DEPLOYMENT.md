# ReadMart Deployment and Maintenance Guide

This document aims to guide you on how to independently deploy the ReadMart system to a production environment and establish a long-term maintenance mechanism.

## 1. Quick Deployment (Vercel)

ReadMart is optimized for Vercel, which is the most recommended deployment method.

1. **Prepare Repository**: Push the code to GitHub/GitLab.
2. **Create Project**: Select the repository in the Vercel dashboard.
3. **Configure Environment Variables**: Fill in all necessary configurations in Vercel's "Environment Variables" settings according to `.env.example`.
4. **Deploy**: Click Deploy. Vercel will automatically recognize the Vite configuration and complete the build.

## 2. Environment Variable Checklist

| Variable Name | Description | Required |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous public key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (for backend use) | Yes |
| `JWT_SECRET` | Random string for generating/verifying tokens | Yes |
| `RESEND_API_KEY` | Resend email service API Key | Yes |

## 3. Security Notes

- **HTTPS**: The system has a built-in `useHttpsEnforcement` hook that automatically redirects insecure requests to HTTPS.
- **Key Management**: Strictly forbid hardcoding any `service_role` or private keys in the frontend code. All frontend access must be through the `anon_key` in conjunction with RLS (Row Level Security) policies.
- **CORS**: In the Supabase dashboard's API settings, add your production domain to "Allowed External Domains".

## 4. Maintenance Plan

- **Dependency Updates**: Run `npm outdated` monthly and update non-breaking versions of dependency packages.
- **Backup Strategy**: Supabase provides automatic database backups. It is recommended to manually export core data (Orders, Profiles) monthly as an off-site backup.
- **Monitoring**:
    - Use Vercel Analytics to track page performance.
    - Recommend integrating Sentry for error monitoring.
    - View API call frequency and database load in the Supabase dashboard.

## 5. Troubleshooting

- **White Screen / Loading Failure**: Check the browser console. If it prompts "Missing environment variables", please confirm if the deployment platform's variable configuration has taken effect.
- **Login Invalid**: Confirm if the `JWT_SECRET` is consistent across different environments.
## 6. KopoKopo Payment Integration (Production)

To enable production payments, follow these steps in the KopoKopo Dashboard:

1. **API Keys**: Go to [KopoKopo Applications](https://app.kopokopo.com/applications) and create a new application to get your `CLIENT_ID`, `CLIENT_SECRET`, and `API_KEY`.
2. **Till Number**: Use the Online Payments Till Number provided in your dashboard.
3. **Webhook Subscriptions**: You must manually subscribe to the following event types to receive payment notifications:
    - `buygoods_transaction_received`
    - `buygoods_transaction_reversed`
    - `m-pesa_payment_received`
    - `card_transaction_received`
    - `card_transaction_voided`
    - `card_transaction_reversed`
    - `paybill_transaction_received` (if using Paybill)
    
   **Webhook URL**: `https://your-domain.com/api/kopokopo/webhook`
   **Scope**: `till`
   **Scope Reference**: Your Till Number

4. **Environment Variables**: Ensure the following are set in Vercel:
    - `KOPOKOPO_ENV`: `production`
    - `KOPOKOPO_CLIENT_ID`: Your production Client ID
    - `KOPOKOPO_CLIENT_SECRET`: Your production Client Secret
    - `KOPOKOPO_API_KEY`: Your production API Key
    - `KOPOKOPO_TILL_NUMBER`: Your production Till Number
    - `KOPOKOPO_WEBHOOK_URL`: `https://your-domain.com/api/kopokopo/webhook`

## 7. Troubleshooting KopoKopo Integration

- **Signature Verification Failed**: Ensure `KOPOKOPO_API_KEY` is correct. The system uses this key to verify that webhooks originated from KopoKopo.
- **Webhook Not Received**: Check the KopoKopo dashboard for webhook delivery status. Ensure your URL is accessible and returns a `200 OK` response.
- **Order Not Marked Paid**: Verify that the `orderId` or `reference` in the webhook payload matches the order ID in the database. The system checks `metadata.order_id`, `metadata.reference`, and `resource.reference`.
