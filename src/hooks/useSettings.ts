import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';

export interface SiteSettings {
  site_logo: string;
  site_name: string;
  whatsapp_link: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  working_hours: string;
  tax_rate?: number;
  default_currency?: string;
  maintenance_mode?: boolean;
  instagram_url?: string;
  facebook_url?: string;
  twitter_url?: string;
  linkedin_url?: string;
  announcement_text?: string;
  membership_wall_active?: boolean;
  membership_price?: number;
  membership_duration_days?: number;
  membership_title?: string;
  membership_description?: string;
}

const defaultSettings: SiteSettings = {
  site_logo: '/assets/logo.jpg',
  site_name: 'ReadMart',
  whatsapp_link: 'https://wa.me/254794129958',
  contact_email: 'support@readmartke.com',
  contact_phone: '+254 794 129 958',
  address: 'Nairobi, Kenya',
  working_hours: 'Mon-Fri: 8am - 5pm',
  tax_rate: 16,
  default_currency: 'KES',
  maintenance_mode: false,
  instagram_url: 'https://instagram.com/readmartke',
  facebook_url: 'https://facebook.com/readmartke',
  twitter_url: 'https://x.com/readmartke',
  linkedin_url: 'https://linkedin.com/company/readmartke',
  announcement_text: '',
  membership_wall_active: false,
  membership_price: 1000,
  membership_duration_days: 30,
  membership_title: 'ReadMart Premium Member',
  membership_description: 'Get exclusive access to book clubs, insights, and early bird events.',
};

export function useSettings() {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .maybeSingle();

        if (error) {
          console.warn('Site settings table not found or error fetching, using defaults:', error.message);
          return;
        }
        
        if (data) {
          setSettings(data);
        }
      } catch (error) {
        console.error('Unexpected error fetching site settings:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, []);

  return { settings, isLoading };
}
