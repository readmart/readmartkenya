import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/retry';

export interface SiteSettings {
  site_logo: string;
  site_name: string;
  whatsapp_link: string;
  contact_email: string;
  contact_phone: string;
  secondary_phone?: string;
  address: string;
  working_hours: string;
  tax_rate?: number;
  default_currency?: string;
  maintenance_mode?: boolean;
  instagram_url?: string;
  facebook_url?: string;
  twitter_url?: string;
  x_url?: string;
  linkedin_url?: string;
  tiktok_url?: string;
  threads_url?: string;
  global_announcement?: string;
  announcement_active?: boolean;
  membership_wall_active?: boolean;
  membership_price?: number;
  membership_duration_days?: number;
  membership_title?: string;
  membership_description?: string;
  author_of_the_day_id?: string | null;
  author_of_the_day_enabled?: boolean;
  author_of_the_day_books?: string[];
  author_of_the_day_image?: string | null;
}

const defaultSettings: SiteSettings = {
  site_logo: '/assets/logo.jpg',
  site_name: 'ReadMart',
  whatsapp_link: 'https://wa.me/254794129958',
  contact_email: 'hello@readmart.com',
  contact_phone: '+254 794 129 958',
  secondary_phone: '+254 741 658 548',
  address: 'Nairobi, Kenya',
  working_hours: 'Mon-Fri: 8am - 5pm',
  tax_rate: 16,
  default_currency: 'KES',
  maintenance_mode: false,
  instagram_url: 'https://www.instagram.com/readmartke?igsh=bWdtZDhvcGZsZWNx',
  facebook_url: 'https://www.facebook.com/share/1LB4jKLTTV/',
  twitter_url: 'https://x.com/readmartke',
  x_url: 'https://x.com/readmartke',
  linkedin_url: 'https://linkedin.com/comm/mynetwork/discovery-see-all?usecase=PEOPLE_FOLLOWS&followMember=read-mart-6797423a1',
  tiktok_url: 'https://www.tiktok.com/@readmartke?_r=1&_t=ZS-92BvAtTmKLn',
  threads_url: 'https://www.threads.net/@readmartke',
  global_announcement: '',
  announcement_active: false,
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
        // Use withRetry for resilience against transient fetch failures
        const siteData = await withRetry(async () => {
          const { data, error } = await supabase
            .from('site_settings')
            .select('*')
            .maybeSingle();

          if (error) throw error;
          return data;
        }, { retries: 2, delay: 500 });

        if (siteData) {
          // Only overwrite defaults with truthy values from database
          const processedSettings = { ...defaultSettings };
          
          Object.keys(siteData).forEach(key => {
            if (siteData[key] !== null && siteData[key] !== undefined && siteData[key] !== '') {
              let value = siteData[key];
              
              // Sanitize dummy numbers
              if (typeof value === 'string' && (value.includes('700 000 000') || value.includes('700000000'))) {
                if (key === 'contact_phone') value = '+254 794 129 958';
                if (key === 'secondary_phone') value = '+254 741 658 548';
                if (key === 'whatsapp_link' || key === 'global_support_whatsapp') value = 'https://wa.me/254794129958';
              }
              
              (processedSettings as any)[key] = value;
            }
          });

          // Special handling for X/Twitter sync
          processedSettings.twitter_url = siteData.x_url || siteData.twitter_url || defaultSettings.twitter_url;
          processedSettings.x_url = siteData.x_url || siteData.twitter_url || defaultSettings.x_url;

          setSettings(processedSettings);
        } else {
          setSettings(defaultSettings);
        }
      } catch (error) {
        console.error('Unexpected error fetching site settings:', error);
        setSettings(defaultSettings);
      } finally {
        setIsLoading(false);
      }
    }

    fetchSettings();
  }, []);

  return { settings, isLoading };
}
