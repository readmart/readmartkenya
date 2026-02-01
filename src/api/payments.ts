import { supabase } from '../lib/supabase/client';

/**
 * Initiates a payment via ReadMart Backend
 */
export async function initiatePayment(orderId: string, phoneNumber: string, amount: number, paymentMethod: string = 'm-pesa') {
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

    const text = await response.text();
    
    if (!response.ok) {
      let errorMessage = 'Failed to initiate payment';
      try {
        const error = JSON.parse(text);
        errorMessage = error.error || error.message || errorMessage;
      } catch (e) {
        // Not a JSON error, maybe HTML?
        if (text.includes('A server error occurred')) {
          errorMessage = 'Server error (500) occurred while initiating payment. Please try again later.';
        } else {
          errorMessage = `HTTP Error ${response.status}: ${text.slice(0, 100)}`;
        }
      }
      throw new Error(errorMessage);
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error('Received invalid JSON response from server');
    }
  } catch (error: any) {
    console.error('Payment Error:', error);
    return { error: error.message || 'Failed to initiate payment' };
  }
}

/**
 * Checks the status of a payment/order
 */
export async function checkPaymentStatus(orderId: string) {
  try {
    let { data: order, error } = await supabase
      .from('orders')
      .select('status, payment_id')
      .eq('id', orderId)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Orders schema cache issue in checkPaymentStatus, falling back to core');
        const { data: fallbackOrder, error: fallbackError } = await supabase
          .from('orders')
          .select('status')
          .eq('id', orderId)
          .maybeSingle();
        
        if (fallbackError) throw fallbackError;
        order = fallbackOrder as any;
      } else {
        throw error;
      }
    }
    return order;
  } catch (error) {
    console.error('Status Check Error:', error);
    return null;
  }
}

/**
 * Checks the status of a membership payment by record ID or user ID
 */
export async function checkMembershipStatus(userId: string, paymentId?: string, recordId?: string) {
  try {
    let query = supabase
      .from('membership_payments')
      .select('status, payment_id');

    if (recordId) {
      query = query.eq('id', recordId);
    } else {
      query = query.eq('user_id', userId);
      if (paymentId) {
        query = query.eq('payment_id', paymentId);
      }
    }

    let { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
        console.warn('Membership payments schema cache issue, falling back to core');
        let fallbackQuery = supabase
          .from('membership_payments')
          .select('status');
        
        if (recordId) {
          fallbackQuery = fallbackQuery.eq('id', recordId);
        } else {
          fallbackQuery = fallbackQuery.eq('user_id', userId);
          if (paymentId) {
            fallbackQuery = fallbackQuery.eq('payment_id', paymentId);
          }
        }
        
        const { data: fallbackData, error: fallbackError } = await fallbackQuery
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
          
        if (fallbackError) throw fallbackError;
        data = fallbackData as any;
      } else {
        throw error;
      }
    }
    return data;
  } catch (error) {
    console.error('Membership Status Check Error:', error);
    return null;
  }
}

/**
 * Registers K2 webhooks (Admin Only)
 */
export async function registerWebhooks() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch('/api/payments?action=register-webhooks', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`
      }
    });

    const text = await response.text();
    
    if (!response.ok) {
      throw new Error(`Registration failed: ${text.slice(0, 100)}`);
    }

    return JSON.parse(text);
  } catch (error: any) {
    console.error('Webhook Registration Error:', error);
    return { error: error.message };
  }
}

/**
 * Initiates a Membership payment
 */
export async function initiateMembershipPayment(phoneNumber: string, amount: number, metadata: any = {}, paymentMethod: string = 'm-pesa') {
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
        metadata,
        paymentMethod
      })
    });

    if (!response.ok) {
      let errorMessage = 'Failed to initiate membership payment';
      try {
        const error = await response.json();
        errorMessage = error.error || error.message || errorMessage;
      } catch (e) {
        const text = await response.text();
        if (text.includes('A server error occurred')) {
          errorMessage = 'Server error (500) occurred. Please try again later.';
        } else {
          errorMessage = `HTTP Error ${response.status}: ${text.slice(0, 100)}`;
        }
      }
      throw new Error(errorMessage);
    }

    try {
      return await response.json();
    } catch (e) {
      throw new Error('Received invalid JSON response from server');
    }
  } catch (error: any) {
    console.error('Membership Payment Error:', error);
    return { error: error.message || 'Failed to initiate membership payment' };
  }
}
