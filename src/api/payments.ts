import { supabase } from '../lib/supabase/client';

/**
 * Initiates a payment via ReadMart Backend
 */
export async function initiateSTKPush(orderId: string, phoneNumber: string, amount: number, paymentMethod: string = 'm-pesa') {
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
        paymentMethod
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
      .maybeSingle();

    if (error) throw error;
    return order;
  } catch (error) {
    console.error('Status Check Error:', error);
    return null;
  }
}

/**
 * Checks the status of a membership payment
 */
export async function checkMembershipStatus(userId: string, paymentId?: string) {
  try {
    let query = supabase
      .from('membership_payments')
      .select('status, payment_id')
      .eq('user_id', userId);

    if (paymentId) {
      query = query.eq('payment_id', paymentId);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Membership Status Check Error:', error);
    return null;
  }
}

/**
 * Initiates a Membership payment
 */
export async function initiateMembershipPayment(phoneNumber: string, amount: number, metadata: any = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch('/api/payments/init', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`
      },
      body: JSON.stringify({
        type: metadata.type || 'membership',
        phone: phoneNumber,
        amount,
        metadata
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to initiate membership payment');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Membership Payment Error:', error);
    return { error: error.message || 'Failed to initiate membership payment' };
  }
}
