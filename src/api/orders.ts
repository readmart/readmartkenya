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
    .select()
    .single();

  if (orderError) {
    console.error('Order creation error details:', orderError);
    throw orderError;
  }

  // 2. Create order items
  const orderItems = orderData.items.map(item => ({
    order_id: order.id,
    product_id: item.product_id,
    quantity: item.quantity,
    price_at_purchase: item.price,
    product_snapshot: item.product_snapshot
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems);

  if (itemsError) throw itemsError;

  // Filter VAT for customer
  const { tax_amount, tax_rate, ...orderForCustomer } = order;
  return orderForCustomer;
}

export async function getOrder(orderId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single();
  const isAdmin = profile?.role === 'founder' || profile?.role === 'admin';

  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, products(*))')
    .eq('id', orderId)
    .single();

  if (error) throw error;

  if (!isAdmin) {
    const { tax_amount, tax_rate, ...dataForCustomer } = data;
    return dataForCustomer;
  }

  return data;
}
