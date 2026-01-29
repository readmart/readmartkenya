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
- **API 403 Error**: Check if Supabase's RLS policies allow operations for the current user role.
