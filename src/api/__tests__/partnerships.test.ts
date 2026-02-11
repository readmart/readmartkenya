import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getPartnershipTiers, 
  getPartners, 
  partnershipTierSchema, 
  partnerProfileSchema,
  createPartnershipTier,
  updatePartnershipTier,
  managePartner,
  deletePartnershipTier
} from '../partnerships';

// Mock Supabase
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } },
        error: null
      })
    }
  }
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Partnership API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Validation Schemas', () => {
    it('should validate a correct partnership tier', () => {
      const validTier = {
        name: 'Gold',
        description: 'Top tier',
        benefits: ['Benefit 1'],
        color_code: '#FFD700',
        display_order: 1,
        is_active: true
      };
      const result = partnershipTierSchema.safeParse(validTier);
      expect(result.success).toBe(true);
    });

    it('should fail on invalid color code', () => {
      const invalidTier = {
        name: 'Invalid',
        color_code: 'not-a-color'
      };
      const result = partnershipTierSchema.safeParse(invalidTier);
      expect(result.success).toBe(false);
    });

    it('should validate a correct partner profile', () => {
      const validPartner = {
        company_name: 'Test Corp',
        website_url: 'https://test.com',
        contact_email: 'contact@test.com',
        status: 'active'
      };
      const result = partnerProfileSchema.safeParse(validPartner);
      expect(result.success).toBe(true);
    });

    it('should fail on invalid email in partner profile', () => {
      const invalidPartner = {
        company_name: 'Test Corp',
        contact_email: 'invalid-email'
      };
      const result = partnerProfileSchema.safeParse(invalidPartner);
      expect(result.success).toBe(false);
    });
  });

  describe('Public Data Fetching', () => {
    it('should fetch active partnership tiers', async () => {
      const mockTiers = [{ id: '1', name: 'Bronze', is_active: true }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockTiers,
      });

      const result = await getPartnershipTiers();
      expect(result).toEqual(mockTiers);
      expect(mockFetch).toHaveBeenCalledWith('/api/partnerships?action=tiers');
    });

    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Error' }),
      });

      const result = await getPartnershipTiers();
      expect(result).toEqual([]);
    });

    it('should fetch active partners with tier info', async () => {
      const mockPartners = [{ id: '1', company_name: 'Partner 1', tier: { name: 'Gold' } }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockPartners,
      });

      const result = await getPartners();
      expect(result).toEqual(mockPartners);
      expect(mockFetch).toHaveBeenCalledWith('/api/partnerships');
    });

    it('should handle fetch partners errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Error' }),
      });

      const result = await getPartners();
      expect(result).toEqual([]);
    });
  });

  describe('Admin Operations', () => {
    const validTierData = {
      name: 'Platinum',
      description: 'Elite tier',
      benefits: ['Priority support'],
      color_code: '#E5E4E2',
      display_order: 0,
      is_active: true
    };

    it('should create a new partnership tier', async () => {
      const mockCreatedTier = { id: 'new-id', ...validTierData };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockCreatedTier,
      });

      const result = await createPartnershipTier(validTierData);
      expect(result).toEqual(mockCreatedTier);
      expect(mockFetch).toHaveBeenCalledWith('/api/partnerships?action=tiers', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer mock-token'
        })
      }));
    });

    it('should update an existing partnership tier', async () => {
      const updateData = { name: 'Updated Gold' };
      const mockUpdatedTier = { id: '1', ...validTierData, ...updateData };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockUpdatedTier,
      });

      const result = await updatePartnershipTier('1', updateData);
      expect(result).toEqual(mockUpdatedTier);
      expect(mockFetch).toHaveBeenCalledWith('/api/partnerships?action=tiers&id=1', expect.objectContaining({
        method: 'PUT'
      }));
    });

    it('should delete a partnership tier', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
      });

      const result = await deletePartnershipTier('1');
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('/api/partnerships?action=tiers&id=1', expect.objectContaining({
        method: 'DELETE'
      }));
    });

    it('should manage partner profile (create)', async () => {
      const partnerData = {
        company_name: 'New Partner',
        contact_email: 'new@partner.com',
        status: 'pending' as const,
        social_links: {},
        is_featured: false
      };
      const mockCreatedPartner = { id: 'p1', ...partnerData, created_at: new Date().toISOString() };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockCreatedPartner,
      });

      const result = await managePartner(null, partnerData);
      expect(result).toEqual(mockCreatedPartner);
      expect(mockFetch).toHaveBeenCalledWith('/api/partnerships', expect.objectContaining({
        method: 'POST'
      }));
    });

    it('should manage partner profile (update)', async () => {
      const partnerData = {
        company_name: 'Existing Partner',
        status: 'active' as const,
        social_links: {},
        is_featured: false
      };
      const mockUpdatedPartner = { id: 'p1', ...partnerData, created_at: new Date().toISOString() };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockUpdatedPartner,
      });

      const result = await managePartner('p1', partnerData);
      expect(result).toEqual(mockUpdatedPartner);
      expect(mockFetch).toHaveBeenCalledWith('/api/partnerships?id=p1', expect.objectContaining({
        method: 'PUT'
      }));
    });

    it('should handle manage partner errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Error' }),
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const partnerData = {
        company_name: 'Test Partner',
        status: 'active' as const,
        is_featured: false,
        social_links: {}
      };
      
      await expect(managePartner('1', partnerData)).rejects.toThrow('Error');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should throw error on admin operation failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Unauthorized' }),
      });

      await expect(deletePartnershipTier('1')).rejects.toThrow('Unauthorized');
    });
  });
});
