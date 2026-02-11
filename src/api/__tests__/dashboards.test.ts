import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPartnershipServices, getPartnerships, getProtocolAgreements } from '../dashboards';
import { supabase } from '@/lib/supabase/client';
import * as apiHelpers from '@/lib/utils/api-helpers';

// Mock Supabase
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'test-user-id' } } },
        error: null
      })
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    }))
  }
}));

// Mock api-helpers
vi.mock('@/lib/utils/api-helpers', () => ({
  verifyAdmin: vi.fn().mockResolvedValue({ user: { id: 'test-user-id' } }),
  verifyRole: vi.fn().mockResolvedValue({ user: { id: 'test-user-id' } }),
  verifyPartner: vi.fn().mockResolvedValue({ user: { id: 'test-user-id' } }),
  calculateTrend: vi.fn().mockReturnValue('+10%'),
  logAudit: vi.fn().mockResolvedValue(null)
}));

describe('Dashboard API - Partnerships', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPartnershipServices', () => {
    it('should fetch active partnership services ordered by display_order', async () => {
      const mockData = [
        { id: '1', name: 'Service 1', display_order: 1 },
        { id: '2', name: 'Service 2', display_order: 2 }
      ];

      const mockOrder = vi.fn().mockResolvedValue({ data: mockData, error: null });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await getPartnershipServices();

      expect(supabase.from).toHaveBeenCalledWith('partnership_services');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('is_active', true);
      expect(mockOrder).toHaveBeenCalledWith('display_order', { ascending: true });
      expect(result).toEqual(mockData);
    });

    it('should return empty array and log error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockError = { message: 'Database error' };

      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: mockError });
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await getPartnershipServices();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getPartnerships (Applications)', () => {
    it('should fetch all partnership applications for admin', async () => {
      (apiHelpers.verifyAdmin as any).mockResolvedValue({ user: { id: 'test-user-id' } });
      const mockData = [{ id: 'app1', full_name: 'Test Partner' }];
      const mockOrder = vi.fn().mockResolvedValue({ data: mockData, error: null });
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await getPartnerships();

      expect(apiHelpers.verifyAdmin).toHaveBeenCalled();
      expect(supabase.from).toHaveBeenCalledWith('partnership_applications');
      expect(result).toEqual(mockData);
    });

    it('should handle admin verification failure', async () => {
      (apiHelpers.verifyAdmin as any).mockRejectedValue(new Error('Unauthorized'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const result = await getPartnerships();
      
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('getProtocolAgreements', () => {
    it('should fetch and normalize protocol agreements', async () => {
      (apiHelpers.verifyAdmin as any).mockResolvedValue({ user: { id: 'test-user-id' } });
      const mockData = [{ id: 'ag1', title: 'Test Agreement' }];
      const mockOrder = vi.fn().mockResolvedValue({ data: mockData, error: null });
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await getProtocolAgreements();

      expect(apiHelpers.verifyAdmin).toHaveBeenCalled();
      expect(supabase.from).toHaveBeenCalledWith('partnership_agreements');
      expect(result).toEqual([{ id: 'ag1', title: 'Test Agreement', name: 'Test Agreement' }]);
    });

    it('should handle 404/PGRST116 errors gracefully', async () => {
      (apiHelpers.verifyAdmin as any).mockResolvedValue({ user: { id: 'test-user-id' } });
      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' }, status: 404 });
      const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
      (supabase.from as any).mockReturnValue({ select: mockSelect });

      const result = await getProtocolAgreements();
      expect(result).toEqual([]);
    });
  });
});
