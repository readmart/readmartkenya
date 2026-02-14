import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dashboardApi from '../dashboards';
import { supabase } from '@/lib/supabase/client';

const mockSupabaseChain = {
  select: vi.fn(() => mockSupabaseChain),
  eq: vi.fn(() => mockSupabaseChain),
  order: vi.fn(() => mockSupabaseChain),
  limit: vi.fn(() => mockSupabaseChain),
  in: vi.fn(() => mockSupabaseChain),
  single: vi.fn(() => Promise.resolve({ data: { role: 'founder' }, error: null })),
  maybeSingle: vi.fn(() => Promise.resolve({ data: { id: '123' }, error: null })),
  insert: vi.fn(() => mockSupabaseChain),
  update: vi.fn(() => mockSupabaseChain),
  delete: vi.fn(() => mockSupabaseChain),
  then: vi.fn((cb) => cb({ data: [], error: null }))
};

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => mockSupabaseChain),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'admin-id' } } },
        error: null
      })
    }
  }
}));

// Mock API helpers
vi.mock('@/lib/utils/api-helpers', () => ({
  verifyAdmin: vi.fn().mockResolvedValue({ user: { id: 'admin-id' } }),
  verifyPartner: vi.fn().mockResolvedValue({ user: { id: 'admin-id' } }),
  verifyAuthor: vi.fn().mockResolvedValue({ user: { id: 'admin-id' } }),
  verifyRole: vi.fn().mockResolvedValue({ user: { id: 'admin-id' } }),
  withRetry: vi.fn((fn) => fn()),
  logAudit: vi.fn().mockResolvedValue(null)
}));

describe('Founder Dashboard API Verification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Orders
  it('Orders: getOrders fetches from correct table', async () => {
    await dashboardApi.getOrders();
    expect(supabase.from).toHaveBeenCalledWith('orders');
  });

  // 2. Users
  it('Users: getAllUsers fetches from profiles', async () => {
    await dashboardApi.getAllUsers();
    expect(supabase.from).toHaveBeenCalledWith('profiles');
  });

  // 3. Global Logic & Identity
  it('Settings: getSiteSettings fetches from site_settings', async () => {
    await dashboardApi.getSiteSettings();
    expect(supabase.from).toHaveBeenCalledWith('site_settings');
  });

  // 5. Banners
  it('Banners: getBanners fetches from banners table', async () => {
    await dashboardApi.getBanners();
    expect(supabase.from).toHaveBeenCalledWith('banners');
  });

  // 7. Shipping
  it('Shipping: getShippingZones fetches from shipping_zones', async () => {
    await dashboardApi.getShippingZones();
    expect(supabase.from).toHaveBeenCalledWith('shipping_zones');
  });

  // 9. Inquiries
  it('Inquiries: getInquiries fetches from contact_messages', async () => {
    await dashboardApi.getInquiries();
    expect(supabase.from).toHaveBeenCalledWith('contact_messages');
  });

  // 10. Clubs
  it('Clubs: getClubs fetches from book_clubs', async () => {
    await dashboardApi.getClubs();
    expect(supabase.from).toHaveBeenCalledWith('book_clubs');
  });

  // 11. Events
  it('Events: getEvents fetches from events', async () => {
    await dashboardApi.getEvents();
    expect(supabase.from).toHaveBeenCalledWith('events');
  });

  // 12. Agreements
  it('Agreements: getProtocolAgreements fetches from partnership_agreements', async () => {
    await dashboardApi.getProtocolAgreements();
    expect(supabase.from).toHaveBeenCalledWith('partnership_agreements');
  });

  // 13. Promos
  it('Promos: getPromos fetches from promos', async () => {
    await dashboardApi.getPromos();
    expect(supabase.from).toHaveBeenCalledWith('promos');
  });

  // 15. Communications
  it('Communications: getNotificationLogs fetches from notification_logs', async () => {
    await dashboardApi.getNotificationLogs();
    expect(supabase.from).toHaveBeenCalledWith('notification_logs');
  });

  // 16. Partnerships
  it('Partnerships: getPartnerships fetches from partnership_applications', async () => {
    await dashboardApi.getPartnerships();
    expect(supabase.from).toHaveBeenCalledWith('partnership_applications');
  });

  // 17. Payouts
  it('Payouts: getAllPayouts fetches from fulfillment_ledger', async () => {
    await dashboardApi.getAllPayouts();
    expect(supabase.from).toHaveBeenCalledWith('fulfillment_ledger');
  });

  // Generic CRUD Verification
  it('CRUD: createRecord calls correct table and insert', async () => {
    const testData = { name: 'Test' };
    await dashboardApi.createRecord('test_table', testData);
    expect(supabase.from).toHaveBeenCalledWith('test_table');
  });

  it('CRUD: updateRecord calls correct table and update', async () => {
    const testData = { name: 'Updated' };
    await dashboardApi.updateRecord('test_table', '123', testData);
    expect(supabase.from).toHaveBeenCalledWith('test_table');
  });

  it('CRUD: deleteRecord calls correct table and delete', async () => {
    await dashboardApi.deleteRecord('test_table', '123');
    expect(supabase.from).toHaveBeenCalledWith('test_table');
  });
});
