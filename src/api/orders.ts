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

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert(orderInsertData)
    .select('id, subtotal_amount, shipping_amount, total_amount, status, payment_method, shipping_address, created_at, tax_amount')
    .single();

  if (orderError) {
    console.error('Order creation error details:', orderError);
    // If it's a schema cache error, try to insert without select(*)
    if (orderError.message?.includes('cache') || orderError.message?.includes('column')) {
       const { data: retryOrder, error: retryError } = await supabase
         .from('orders')
         .insert(orderInsertData)
         .select('id')
         .single();
       
       if (retryError) throw retryError;
       return retryOrder;
    }
    throw orderError;
  }

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

  if (itemsError) throw itemsError;

  // Filter VAT for customer
  const { tax_amount, ...orderForCustomer } = order;
  return orderForCustomer;
}

export async function getOrder(orderId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  
  let profile;
  try {
    const { data: profileData, error: profileError } = await supabase.from('profiles').select('role').eq('id', user?.id).single();
    if (profileError && (profileError.code === 'PGRST204' || profileError.message?.includes('cache'))) {
      const { data: retryProfile } = await supabase.from('profiles').select('role').eq('id', user?.id).single();
      profile = retryProfile;
    } else {
      profile = profileData;
    }
  } catch (e) {
    console.warn('Profile fetch failed in getOrder');
  }

  const isAdmin = profile?.role === 'founder' || profile?.role === 'admin';

  const orderColumns = `
    id,
    user_id,
    total_amount,
    subtotal_amount,
    shipping_amount,
    tax_amount,
    status,
    payment_method,
    shipping_address,
    shipping_zone_id,
    created_at,
    order_items(
      id,
      order_id,
      product_id,
      quantity,
      price,
      price_at_purchase,
      product_snapshot,
      products(id, title, image_url, description)
    )
  `;

  let { data, error } = await supabase
    .from('orders')
    .select(orderColumns)
    .eq('id', orderId)
    .single();

  if (error) {
    if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
      console.warn('Advanced order columns missing, falling back to core');
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('orders')
        .select(`
          id, user_id, total_amount, status, created_at,
          order_items(id, product_id, quantity, price)
        `)
        .eq('id', orderId)
        .single();
      
      if (fallbackError) throw fallbackError;
      data = fallbackData as any;
    } else {
      throw error;
    }
  }

  if (!isAdmin && data) {
    const { tax_amount, ...dataForCustomer } = data;
    return dataForCustomer;
  }

  return data;
}
