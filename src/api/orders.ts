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
  total_amount: number;
  items: OrderItem[];
  payment_method: string;
}

export async function createOrder(orderData: OrderData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User must be logged in to place an order');

  // 1. Create the order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: user.id,
      total_amount: orderData.total_amount,
      shipping_address: {
        full_name: orderData.full_name,
        email: orderData.email,
        phone: orderData.phone,
        address: orderData.address,
        city: orderData.city
      },
      status: 'pending'
    })
    .select()
    .single();

  if (orderError) throw orderError;

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

  return order;
}

export async function getOrder(orderId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, products(*))')
    .eq('id', orderId)
    .single();

  if (error) throw error;
  return data;
}
