import { useQuery } from '@tanstack/react-query';
import { getProducts, getProductById, getProductBySlug } from '@/api/products';

export function useProducts(options: Parameters<typeof getProducts>[0] = {}) {
  return useQuery({
    queryKey: ['products', options],
    queryFn: () => getProducts(options),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

export function useProduct(idOrSlug: string, isSlug = false) {
  return useQuery({
    queryKey: ['product', idOrSlug],
    queryFn: () => isSlug ? getProductBySlug(idOrSlug) : getProductById(idOrSlug),
    staleTime: 1000 * 60 * 10, // 10 minutes
    enabled: !!idOrSlug,
  });
}
