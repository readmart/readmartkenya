# Resend Activation Guide for ReadMart

To fully activate the email system and move from sandbox to production delivery, follow these steps in your [Resend Dashboard](https://resend.com/overview).

## 1. Domain Verification
Resend requires you to verify ownership of `readmartke.com` to send emails from that domain.

1. Go to **Domains** > **Add Domain**.
2. Enter `readmartke.com` and select your region (e.g., `us-east-1`).
3. Resend will provide 3-4 DNS records (DKIM, SPF, and MX).
4. **Action**: Log into your domain registrar (e.g., Namecheap, GoDaddy, or Cloudflare) and add these records.
5. Click **Verify** in Resend. Once verified, you can send emails from any address @readmartke.com.

## 2. API Key Configuration
1. Go to **API Keys** > **Create API Key**.
2. Name it `ReadMart Production`.
3. Set permissions to `Full Access`.
4. **Action**: Copy the generated key immediately.
5. **Vercel Setup**: Add this key to your Vercel environment variables as `RESEND_API_KEY`.
   - `vercel env add RESEND_API_KEY production`
   - Or via Vercel Dashboard: **Settings** > **Environment Variables**.

## 3. Webhook Integration (Optional but Recommended)
To track email opens, clicks, and bounces in real-time within the ReadMart dashboard:

1. Go to **Webhooks** > **Add Webhook**.
2. Set the URL to `https://readmartke.com/api/webhooks/resend`.
3. Select events: `sent`, `delivered`, `bounced`, `complained`.
4. **Action**: Copy the Webhook Secret and add it to Vercel as `RESEND_WEBHOOK_SECRET`.

## 4. Environment Variables Summary
Ensure the following variables are set in your production environment:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `RESEND_API_KEY` | Your Resend API Key | `re_123456789...` |
| `EMAIL_FROM` | Default sender address | `ReadMart <no-reply@readmartke.com>` |
| `RESEND_WEBHOOK_SECRET` | Secret for verifying webhooks | `whsec_...` |

## 5. Testing the Activation
Once the domain is verified and the API key is set:
1. Navigate to the **Founder Dashboard** > **Communications**.
2. Use the **Dispatch Communication** tool.
3. Send a test email to your personal address.
4. Check the **Transmission Log** for a "sent" status.
