import { supabase } from '../lib/supabase/client';

/**
 * Initiates an M-Pesa STK Push via ReadMart Backend
 */
export async function initiateSTKPush(orderId: string, phoneNumber: string, amount: number) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch('/api/payments/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({
        orderId,
        phone: phoneNumber,
        amount,
        // We can optionally pass more info if needed, but backend can fetch from orderId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to initiate payment');
    }

    return await response.json();
  } catch (error: any) {
    console.error('STK Push Error:', error);
    return { error: error.message || 'Failed to initiate payment' };
  }
}

/**
 * Checks the status of a payment/order
 */
export async function checkPaymentStatus(orderId: string) {
  try {
    const { data: order, error } = await supabase
      .from('orders')
      .select('status, payment_id')
      .eq('id', orderId)
      .single();

    if (error) throw error;
    return order;
  } catch (error) {
    console.error('Status Check Error:', error);
    return null;
  }
}
