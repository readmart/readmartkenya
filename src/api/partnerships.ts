import { supabase } from '@/lib/supabase/client';
import { z } from 'zod';
import { verifyAdmin, logAudit } from '@/lib/utils/api-helpers';

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

export const partnershipApplicationSchema = z.object({
  company_name: z.string().min(2).max(100),
  contact_name: z.string().min(2).max(100),
  contact_email: z.string().email(),
  contact_phone: z.string().optional(),
  website_url: z.string().url().optional().or(z.literal('')),
  category: z.string().min(2),
  description: z.string().min(10),
  tier_id: z.string().uuid(),
  proof_url: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional().default('pending'),
});

export type PartnershipApplication = z.infer<typeof partnershipApplicationSchema> & { id: string; created_at: string };
export type PartnershipTier = z.infer<typeof partnershipTierSchema> & { id: string; created_at: string };
export type PartnerProfile = z.infer<typeof partnerProfileSchema> & { id: string; created_at: string; user_id?: string };

// --- Public API Functions ---

/**
 * Submit a partnership application
 */
export async function applyToPartnership(applicationData: z.input<typeof partnershipApplicationSchema>) {
  try {
    const validatedData = partnershipApplicationSchema.parse(applicationData);
    const { data, error } = await supabase
      .from('partnership_applications')
      .insert([validatedData])
      .select()
      .single();

    if (error) throw error;

    // Trigger notification email (optional: we can add this to an edge function later)
    return data as PartnershipApplication;
  } catch (err) {
    console.error('Failed to submit partnership application:', err);
    throw err;
  }
}

/**
 * Fetch all active partnership tiers
 */
export async function getPartnershipTiers() {
  try {
    const { data, error } = await supabase
      .from('partnership_tiers')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data as PartnershipTier[];
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
    const { data, error } = await supabase
      .from('partners')
      .select('*, partnership_tiers(name, color_code)')
      .eq('status', 'active');

    if (error) throw error;
    return data;
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
    await verifyAdmin();
    const validatedData = partnershipTierSchema.parse(tierData);

    const { data, error } = await supabase
      .from('partnership_tiers')
      .insert([validatedData])
      .select()
      .single();

    if (error) throw error;
    
    await logAudit('create_tier', 'partnership_tiers', data.id, validatedData);
    return data as PartnershipTier;
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
    await verifyAdmin();
    const { data: oldData } = await supabase
      .from('partnership_tiers')
      .select('*')
      .eq('id', id)
      .single();

    const { data, error } = await supabase
      .from('partnership_tiers')
      .update(tierData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await logAudit('update_tier', 'partnership_tiers', id, tierData, oldData);
    return data as PartnershipTier;
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
    await verifyAdmin();
    const validatedData = partnerProfileSchema.parse(partnerData);

    let result;
    if (id) {
      const { data: oldData } = await supabase
        .from('partners')
        .select('*')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('partners')
        .update(validatedData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      await logAudit('update_partner', 'partners', id, validatedData, oldData);
      result = data;
    } else {
      const { data, error } = await supabase
        .from('partners')
        .insert([validatedData])
        .select()
        .single();
      
      if (error) throw error;
      await logAudit('create_partner', 'partners', data.id, validatedData);
      result = data;
    }

    return result as PartnerProfile;
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
    await verifyAdmin();
    const { data: oldData } = await supabase
      .from('partnership_tiers')
      .select('*')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('partnership_tiers')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await logAudit('delete_tier', 'partnership_tiers', id, null, oldData);
    return true;
  } catch (err) {
    console.error('Failed to delete partnership tier:', err);
    throw err;
  }
}

/**
 * Delete a partner profile (Admin only)
 */
export async function deletePartner(id: string) {
  try {
    await verifyAdmin();
    const { data: oldData } = await supabase
      .from('partners')
      .select('*')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('partners')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await logAudit('delete_partner', 'partners', id, null, oldData);
    return true;
  } catch (err) {
    console.error('Failed to delete partner:', err);
    throw err;
  }
}

/**
 * Manage partnership applications (Admin only)
 */
export async function getPartnershipApplications() {
  try {
    await verifyAdmin();
    const { data, error } = await supabase
      .from('partnership_applications')
      .select('*, partnership_tiers(name, color_code)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Failed to fetch partnership applications:', err);
    return [];
  }
}

/**
 * Update application status (Admin only)
 */
export async function updateApplicationStatus(id: string, status: 'approved' | 'rejected') {
  try {
    await verifyAdmin();
    const { data: oldData } = await supabase
      .from('partnership_applications')
      .select('*')
      .eq('id', id)
      .single();

    const { data, error } = await supabase
      .from('partnership_applications')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await logAudit('update_application_status', 'partnership_applications', id, { status }, oldData);

    // If approved, we should also create a partner profile automatically
    if (status === 'approved') {
      const profileData = {
        company_name: data.company_name,
        tier_id: data.tier_id,
        website_url: data.website_url,
        contact_email: data.contact_email,
        description: data.description,
        status: 'active' as const,
        social_links: {},
        is_featured: false
      };
      await managePartner(null, profileData);
      await logAudit('auto_create_partner', 'partners', null, profileData);
    }

    return data;
  } catch (err) {
    console.error('Failed to update application status:', err);
    throw err;
  }
}
