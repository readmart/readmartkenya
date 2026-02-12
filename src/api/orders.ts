import { supabase } from '../lib/supabase/client';

export interface OrderItem {
  product_id: string;
  quantity: number;
  price: number;
  product_snapshot: any;
}

export interface OrderData {
  full_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  subtotal_amount: number;
  shipping_amount: number;
  shipping_zone_id?: string;
  items: OrderItem[];
  payment_method: string;
}

export async function createOrder(orderData: OrderData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User must be logged in to place an order');

  // 1. Create the order
  const orderInsertData: any = {
    user_id: user.id,
    subtotal_amount: orderData.subtotal_amount,
    shipping_amount: orderData.shipping_amount,
    shipping_address: {
      full_name: orderData.full_name,
      email: orderData.email,
      phone: orderData.phone,
      address: orderData.address,
      city: orderData.city
    },
    status: 'pending',
    payment_method: orderData.payment_method || 'm-pesa'
  };

  // Only add shipping_zone_id if it's provided and not empty
  if (orderData.shipping_zone_id && orderData.shipping_zone_id.trim() !== '') {
    orderInsertData.shipping_zone_id = orderData.shipping_zone_id;
  }

  const { data, error } = await supabase
    .from('orders')
    .insert(orderInsertData)
    .select('*')
    .maybeSingle();

  let order = data;
  const orderError = error;

  if (orderError) {
    console.error('Order creation error details:', orderError);
    // If it's a schema cache error, try to insert without select(*)
    if (orderError.message?.includes('cache') || orderError.message?.includes('column') || orderError.code === 'PGRST204') {
       const { data: retryOrder, error: retryError } = await supabase
         .from('orders')
         .insert(orderInsertData)
         .select('id')
         .maybeSingle();
       
       if (retryError) throw retryError;
       if (!retryOrder) throw new Error('Order creation failed after retry');
       order = retryOrder;
    } else {
      throw orderError;
    }
  }

  if (!order) throw new Error('Order creation failed');

  // 2. Create order items
  const orderItems = orderData.items.map(item => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
    price: item.price,
    price_at_purchase: item.price,
    product_snapshot: item.product_snapshot
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems);

  if (itemsError) {
    console.error('Order items creation error details:', itemsError);
    // If it's a schema cache error or missing column, try to insert without problematic columns if needed
    // For now, we'll try a retry if it's a cache issue
    if (itemsError.message?.includes('cache') || itemsError.message?.includes('column') || itemsError.code === 'PGRST204') {
       const { error: retryError } = await supabase
         .from('order_items')
         .insert(orderItems.map(({ product_snapshot, ...rest }) => rest)); // Try without snapshot as fallback
       
       if (retryError) throw retryError;
    } else {
      throw itemsError;
    }
  }

  // Filter VAT for customer
  const { tax_amount, ...orderForCustomer } = order;
  return orderForCustomer;
}

export async function getOrder(orderId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  
  let profile;
  try {
    const { data: profileData, error: profileError } = await supabase.from('profiles').select('role').eq('id', user?.id).maybeSingle();
    if (profileError && (profileError.code === 'PGRST204' || profileError.message?.includes('cache'))) {
      const { data: retryProfile } = await supabase.from('profiles').select('role').eq('id', user?.id).maybeSingle();
      profile = retryProfile;
    } else {
      profile = profileData;
    }
  } catch (e) {
    console.warn('Failed to fetch profile for order check:', e);
  }

  const query = supabase
    .from('orders')
    .select(`
      *,
      items:order_items(
        *,
        product:products(id, title, image_url, type, metadata)
      )
    `)
    .eq('id', orderId);

  // If not admin, restrict to own orders
  if (profile?.role !== 'admin' && profile?.role !== 'founder') {
    query.eq('user_id', user?.id);
  }

  const { data, error } = await query.maybeSingle();
  
  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('cache') || error.message?.includes('column')) {
      console.warn('Order fetch schema cache issue, retrying with minimal select');
      const { data: retryData, error: retryError } = await supabase
        .from('orders')
        .select(`
          id, user_id, total_amount, subtotal_amount, shipping_amount, tax_amount, status, shipping_address, created_at,
          items:order_items(
            id, order_id, product_id, quantity, unit_price, price_at_purchase,
            product:products(id, title, image_url, type, metadata)
          )
        `)
        .eq('id', orderId)
        .maybeSingle();
      
      if (retryError) throw retryError;
      return retryData;
    }
    throw error;
  }
  
  return data;
}
