import { supabase } from '@/lib/supabase/client';
import { z } from 'zod';

// --- Validation Schemas ---

export const partnershipTierSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().optional(),
  benefits: z.array(z.string()).default([]),
  min_requirement: z.string().optional(),
  color_code: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).default('#808080'),
  display_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

export const partnerProfileSchema = z.object({
  company_name: z.string().min(2).max(100),
  tier_id: z.string().uuid().optional(),
  logo_url: z.string().url().optional().or(z.literal('')),
  website_url: z.string().url().optional().or(z.literal('')),
  description: z.string().optional(),
  category: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal('')),
  contact_phone: z.string().optional(),
  social_links: z.record(z.string(), z.string()).default({}),
  is_featured: z.boolean().default(false),
  status: z.enum(['active', 'inactive', 'pending']).default('active'),
});

export type PartnershipTier = z.infer<typeof partnershipTierSchema> & { id: string; created_at: string };
export type PartnerProfile = z.infer<typeof partnerProfileSchema> & { id: string; created_at: string; user_id?: string };

// --- Public API Functions ---

/**
 * Fetch all active partnership tiers
 */
export async function getPartnershipTiers() {
  try {
    const response = await fetch('/api/partnerships?action=tiers');
    if (!response.ok) throw new Error('Failed to fetch tiers');
    return await response.json() as PartnershipTier[];
  } catch (err) {
    console.error('Failed to fetch partnership tiers:', err);
    return [];
  }
}

/**
 * Fetch all active partners
 */
export async function getPartners() {
  try {
    const response = await fetch('/api/partnerships');
    if (!response.ok) throw new Error('Failed to fetch partners');
    return await response.json();
  } catch (err) {
    console.error('Failed to fetch partners:', err);
    return [];
  }
}

// --- Admin API Functions ---

/**
 * Create a new partnership tier (Admin only)
 */
export async function createPartnershipTier(tierData: z.infer<typeof partnershipTierSchema>) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const validatedData = partnershipTierSchema.parse(tierData);

    const response = await fetch('/api/partnerships?action=tiers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
      },
      body: JSON.stringify(validatedData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create tier');
    }

    return await response.json() as PartnershipTier;
  } catch (err) {
    console.error('Failed to create partnership tier:', err);
    throw err;
  }
}

/**
 * Update a partnership tier (Admin only)
 */
export async function updatePartnershipTier(id: string, tierData: Partial<z.infer<typeof partnershipTierSchema>>) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`/api/partnerships?action=tiers&id=${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
      },
      body: JSON.stringify(tierData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update tier');
    }

    return await response.json() as PartnershipTier;
  } catch (err) {
    console.error('Failed to update partnership tier:', err);
    throw err;
  }
}

/**
 * Manage partner profiles (Admin only)
 */
export async function managePartner(id: string | null, partnerData: z.infer<typeof partnerProfileSchema>) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const validatedData = partnerProfileSchema.parse(partnerData);

    const url = id ? `/api/partnerships?id=${id}` : '/api/partnerships';
    const method = id ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
      },
      body: JSON.stringify(validatedData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to manage partner');
    }

    return await response.json() as PartnerProfile;
  } catch (err) {
    console.error('Failed to manage partner profile:', err);
    throw err;
  }
}

/**
 * Delete a partnership tier (Admin only)
 */
export async function deletePartnershipTier(id: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(`/api/partnerships?action=tiers&id=${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete tier');
    }

    return true;
  } catch (err) {
    console.error('Failed to delete partnership tier:', err);
    throw err;
  }
}
