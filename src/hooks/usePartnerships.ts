import { useQuery } from '@tanstack/react-query';
import { getPartnershipTiers, getPartners } from '@/api/partnerships';

export function usePartnershipTiers() {
  return useQuery({
    queryKey: ['partnership-tiers'],
    queryFn: getPartnershipTiers,
    staleTime: 1000 * 60 * 15, // 15 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });
}

export function usePartners() {
  return useQuery({
    queryKey: ['partners'],
    queryFn: getPartners,
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}
