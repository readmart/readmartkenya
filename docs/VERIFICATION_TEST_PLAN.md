# Founder Dashboard Verification Test Plan

This document outlines the systematic verification process for all 17 tabs in the ReadMart Founder Dashboard.

## 1. Orders
- **Test Case 1.1**: Fetch orders list. Verify data matches `orders` table.
- **Test Case 1.2**: Update order status (e.g., 'paid' to 'processing'). Verify DB update and audit log.
- **Test Case 1.3**: Verify financial calculations (subtotal, tax, total) on new order creation.
- **Test Case 1.4**: Check RBAC: Only admin/founder can update status.

## 2. Users
- **Test Case 2.1**: List all users. Verify PII access for founder/admin.
- **Test Case 2.2**: Update user status (Active/Inactive). Verify profile update.
- **Test Case 2.3**: Role management: Attempt to promote a user.

## 3. Global Logic
- **Test Case 3.1**: Fetch site settings. Verify default values.
- **Test Case 3.2**: Update site settings (tax_rate, maintenance_mode). Verify persistence.
- **Test Case 3.3**: Verify settings update audit logging.

## 4. Identity
- **Test Case 4.1**: Update brand identity (site_name, site_logo).
- **Test Case 4.2**: Verify logo upload to Supabase storage.
- **Test Case 4.3**: Verify social link updates.

## 5. Banners
- **Test Case 5.1**: Create new banner. Verify image upload and DB record.
- **Test Case 5.2**: Update existing banner.
- **Test Case 5.3**: Delete banner and verify storage cleanup.

## 6. Author of the Day
- **Test Case 6.1**: Select author of the day. Verify `site_settings` update.
- **Test Case 6.2**: Select featured books for the author.
- **Test Case 6.3**: Verify image upload for author highlight.

## 7. Shipping Methods
- **Test Case 7.1**: Create shipping zone.
- **Test Case 7.2**: Update zone rates and active status.
- **Test Case 7.3**: Delete shipping zone.

## 8. City/Area Management
- **Test Case 8.1**: Create area within a shipping zone.
- **Test Case 8.2**: Update area details.
- **Test Case 8.3**: Verify association between areas and zones.

## 9. Inquiries
- **Test Case 9.1**: Fetch contact messages.
- **Test Case 9.2**: Update inquiry status (Read/Unread/Replied).
- **Test Case 9.3**: Verify realtime sync for new messages.

## 10. Clubs
- **Test Case 10.1**: Create book club. Verify slug generation and image upload.
- **Test Case 10.2**: Update club details.
- **Test Case 10.3**: Delete club and verify storage cleanup.

## 11. Events
- **Test Case 11.1**: Create event with date and location.
- **Test Case 11.2**: Update event status and details.
- **Test Case 11.3**: Verify event RSVPs fetching.

## 12. Agreements
- **Test Case 12.1**: Fetch all protocol agreements.
- **Test Case 12.2**: Upload new agreement template.
- **Test Case 12.3**: Verify RBAC for signing/uploading agreements.

## 13. Promos
- **Test Case 13.1**: Create promo code with validations (percentage vs fixed).
- **Test Case 13.2**: Toggle promo status.
- **Test Case 13.3**: Verify promo metrics (usage count).

## 14. Newsletter
- **Test Case 14.1**: Fetch subscribers list.
- **Test Case 14.2**: Update subscription status.
- **Test Case 14.3**: Verify "Sync Steme" simulation.

## 15. Communications
- **Test Case 15.1**: Send custom email from dashboard.
- **Test Case 15.2**: Fetch notification logs.
- **Test Case 15.3**: Verify email template application.

## 16. Partnerships
- **Test Case 16.1**: Fetch partnership applications.
- **Test Case 16.2**: Update application status (Approve/Reject).
- **Test Case 16.3**: Verify service list fetching.

## 17. Payouts
- **Test Case 17.1**: Fetch all payouts from fulfillment ledger.
- **Test Case 17.2**: Trigger disbursement engine.
- **Test Case 17.3**: Verify payout status updates.
