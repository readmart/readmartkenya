import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPartnershipTiers, getPartners, partnershipTierSchema, partnerProfileSchema } from '../partnerships';

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
  });

  describe('Data Fetching', () => {
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
  });
});
