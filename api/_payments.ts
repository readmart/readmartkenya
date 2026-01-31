import crypto from 'crypto';
import { fetchWithTimeout } from './_utils.js';

const getK2Env = () => {
  if (process.env.KOPOKOPO_ENV) return process.env.KOPOKOPO_ENV;
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  return isProduction ? 'production' : 'sandbox';
};

export const getK2BaseUrl = () => getK2Env() === 'production' 
  ? 'https://api.kopokopo.com' 
  : 'https://sandbox.kopokopo.com';

export const getK2AuthUrl = () => getK2BaseUrl();

/**
 * Robust callback URL generator for ReadMart Payments webhooks
 */
export const getK2CallbackUrl = (orderId?: string) => {
  // Use explicit environment variable if provided (user requested https://readmartke.com/api/kopokopo/webhook)
  if (process.env.KOPOKOPO_WEBHOOK_URL) {
    const baseUrl = process.env.KOPOKOPO_WEBHOOK_URL;
    return `${baseUrl}${orderId ? (baseUrl.includes('?') ? '&' : '?') + `orderId=${orderId}` : ''}`;
  }

  const domain = process.env.VERCEL_URL || process.env.PUBLIC_DOMAIN || 'readmartke.com';
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const baseUrl = `https://${cleanDomain}`;
  
  return `${baseUrl}/api/payments/webhook${orderId ? `?orderId=${orderId}` : ''}`;
};

export interface K2StkPushRequest {
  amount: number;
  currency?: string;
  phone: string;
  orderId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  callbackUrl?: string;
}

export interface K2CardPaymentRequest {
  amount: number;
  currency?: string;
  orderId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  callbackUrl?: string;
}

let cachedToken: { token: string; expiry: number } | null = null;

/**
 * Enhanced fetch with exponential backoff for 429 errors
 */
async function fetchWithBackoff(url: string, options: any, retries = 3, backoff = 1000) {
  try {
    const response = await fetchWithTimeout(url, options);
    
    if (response.status === 429 && retries > 0) {
      console.warn(`Rate limited (429) on ${url}. Retrying in ${backoff}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithBackoff(url, options, retries - 1, backoff * 2);
    }
    
    return response;
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithBackoff(url, options, retries - 1, backoff * 2);
    }
    throw error;
  }
}

export const getK2Token = async () => {
  if (cachedToken && cachedToken.expiry > Date.now()) {
    return cachedToken.token;
  }

  const clientId = (process.env.KOPOKOPO_CLIENT_ID || '').trim();
  const clientSecret = (process.env.KOPOKOPO_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    throw new Error('ReadMart Payments credentials (CLIENT_ID, CLIENT_SECRET) are not configured');
  }

  const authUrl = `${getK2AuthUrl()}/oauth/token`;
  
  const response = await fetchWithBackoff(authUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'ReadMart/1.0.0 (https://readmartke.com)'
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get K2 token (Status ${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { expires_in?: number; access_token: string };
  
  const expiresIn = data.expires_in || 3600;
  cachedToken = {
    token: data.access_token,
    expiry: Date.now() + (expiresIn - 600) * 1000, 
  };

  return data.access_token;
};

export const initiateK2StkPush = async (params: K2StkPushRequest) => {
  const token = await getK2Token();
  const apiKey = process.env.KOPOKOPO_API_KEY;
  const tillNumber = process.env.KOPOKOPO_TILL_NUMBER;

  if (!apiKey || !tillNumber) {
    throw new Error('ReadMart Payments (K2) API key or Till Number is not configured');
  }

  // Ensure phone number is in format +254...
  let numericPhone = params.phone.replace(/\D/g, '');
  if (numericPhone.startsWith('0')) {
    numericPhone = '254' + numericPhone.substring(1);
  } else if (!numericPhone.startsWith('254')) {
    numericPhone = '254' + numericPhone;
  }
  const formattedPhone = `+${numericPhone}`;

  const payload = {
    payment_channel: 'M-PESA STK Push',
    till_number: tillNumber,
    subscriber: {
      first_name: params.firstName || 'ReadMart',
      last_name: params.lastName || 'Customer',
      phone_number: formattedPhone,
      email: params.email || '',
    },
    amount: {
      currency: params.currency || 'KES',
      value: Math.round(params.amount), // Ensure it's an integer for K2
    },
    metadata: {
      order_id: params.orderId,
      customer_id: params.email || params.orderId,
      reference: params.orderId,
      notes: `Order #${params.orderId.slice(0, 8).toUpperCase()}`
    },
    _links: {
      callback_url: params.callbackUrl || getK2CallbackUrl(params.orderId),
    },
  };

  const response = await fetchWithBackoff(`${getK2BaseUrl()}/api/v1/incoming_payments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      'User-Agent': 'ReadMart/1.0.0 (https://readmartke.com)'
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`K2 STK Push failed (Status ${response.status}): ${errorText}`);
  }

  const location = response.headers.get('location');
  let result: Record<string, unknown> = {};
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    result = await response.json() as Record<string, unknown>;
  }
  
  return { ...result, location };
};

export const registerK2Webhook = async (eventType: string, callbackUrl: string, scope = 'till', scopeReference?: string) => {
  const token = await getK2Token();
  const apiKey = process.env.KOPOKOPO_API_KEY;
  const tillNumber = scopeReference || process.env.KOPOKOPO_TILL_NUMBER;

  if (!tillNumber) {
    throw new Error('Till Number is required for webhook registration');
  }

  const payload = {
    event_type: eventType,
    url: callbackUrl,
    scope: scope,
    scope_reference: tillNumber
  };

  const baseUrl = getK2BaseUrl();
  console.log(`Registering webhook: ${eventType} at ${callbackUrl} using base URL ${baseUrl}`);

  const commonHeaders: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'ReadMart/1.0.0 (https://readmartke.com)'
  };

  if (apiKey) {
    commonHeaders['X-Api-Key'] = apiKey;
  }

  // K2 uses underscores in their API endpoints
  const response = await fetchWithBackoff(`${baseUrl}/api/v1/webhook_subscriptions`, {
    method: 'POST',
    headers: commonHeaders,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.warn(`K2 Webhook Registration initial attempt failed (Status ${response.status}): ${errorText}`);

    // Some versions use hyphen, try as fallback if 404
    if (response.status === 404) {
      console.log('Attempting fallback hyphenated endpoint: /api/v1/webhook-subscriptions');
      const fallbackResponse = await fetchWithBackoff(`${baseUrl}/api/v1/webhook-subscriptions`, {
        method: 'POST',
        headers: commonHeaders,
        body: JSON.stringify(payload)
      });
      
      if (fallbackResponse.ok) {
        console.log('Hyphenated endpoint succeeded.');
        return await fallbackResponse.json();
      }
      
      const fallbackError = await fallbackResponse.text();
      throw new Error(`K2 Webhook Registration failed both endpoints. Original: ${errorText}. Fallback: ${fallbackError}`);
    }
    throw new Error(`K2 Webhook Registration failed (Status ${response.status}): ${errorText}`);
  }

  return await response.json();
};

export const K2_EVENT_TYPES = {
  STK_PUSH_SUCCESS: 'incoming_payment',
  BUYGOODS_RECEIVED: 'buygoods_transaction_received',
  PAYBILL_RECEIVED: 'paybill_transaction_received',
  CARD_RECEIVED: 'card_transaction_received',
  CARD_VOIDED: 'card_transaction_voided',
  CARD_REVERSED: 'card_transaction_reversed',
  BUYGOODS_REVERSED: 'buygoods_transaction_reversed',
  B2B_RECEIVED: 'b2b_transaction_received',
  CUSTOMER_CREATED: 'customer_created',
  SETTLEMENT_COMPLETED: 'settlement_transfer_completed',
  M_PESA_PAYMENT_RECEIVED: 'm-pesa_payment_received',
};

export const getK2TransactionStatus = async (transactionId: string) => {
  const token = await getK2Token();
  
  // Try incoming_payments first (standard for STK Push)
  let response = await fetchWithBackoff(`${getK2BaseUrl()}/api/v1/incoming_payments/${transactionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'ReadMart/1.0.0 (https://readmartke.com)'
    },
  });

  // If not found, it might be a different resource type (like card or buygoods)
  // KopoKopo often uses different endpoints for different transaction types
  if (!response.ok && response.status === 404) {
    // We could try other endpoints here if documented, 
    // but for now we'll just return the 404 error text
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get K2 transaction status: ${errorText}`);
  }

  return await response.json();
};

export const verifyK2Signature = (payload: any, signature: string) => {
  // Try Webhook Secret first, then Client Secret, then API Key
  const secret = (
    process.env.KOPOKOPO_WEBHOOK_SECRET || 
    process.env.KOPOKOPO_CLIENT_SECRET || 
    process.env.KOPOKOPO_API_KEY || 
    ''
  ).trim();
  
  if (!secret || !signature) {
    console.warn('Missing KOPOKOPO_CLIENT_SECRET/API_KEY or signature for verification');
    return false;
  }

  try {
    const bodyString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const hash = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
    
    // Some versions use hex, some might use base64
    if (hash === signature) return true;
    
    const hashBase64 = crypto.createHmac('sha256', secret).update(bodyString).digest('base64');
    return hashBase64 === signature;
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
};

export const extractK2WebhookData = (payload: any) => {
  // 1. Identify the core data structure
  // KopoKopo webhooks often have a 'data' wrapper or are top-level
  const data = payload.data?.attributes || payload.attributes || payload;
  const event = payload.event || data.event || {};
  const resource = event.resource || data.resource || payload.resource || {};
  const metadata = data.metadata || payload.metadata || resource.metadata || {};

  // 2. Resolve Event Type
  const eventType = (
    payload.topic ||              // Top level (buygoods_transaction_received, etc.)
    payload.data?.type ||         // JSON:API style
    event.type ||                 // Inside event object (Buygoods Transaction)
    data.type || 
    payload.type
  );

  // 3. Extract Status
  const status = (
    resource.status || 
    data.status || 
    payload.status || 
    (data.state === 'success' ? 'Success' : data.state)
  );

  // 4. Determine Success
  const isSuccess = [
    'Success', 'Completed', 'Received', 'success', 'Transferred', 'Processed'
  ].includes(status);

  // 5. Extract Amount (can be object {value, currency} or direct string)
  const amountObj = resource.amount || data.amount || payload.amount || {};
  let amount = typeof amountObj === 'object' ? (amountObj.value || amountObj.amount) : amountObj;
  
  // Handle string amounts directly (as in the sample payload)
  if (!amount && typeof resource.amount === 'string') {
    amount = resource.amount;
  }
  
  const currency = typeof amountObj === 'object' ? (amountObj.currency) : (resource.currency || data.currency || 'KES');
  
  // 6. Extract Phone Number or Card Number
  const phone = (
    resource.sender_phone_number || 
    resource.phone_number || 
    resource.subscriber?.phone_number || 
    metadata.phone ||
    metadata.phoneNumber ||
    resource.sender_msisdn
  );

  // 7. Extract Transaction ID (M-Pesa Receipt Number or K2 Reference)
  // The 'id' at the top level is the Webhook Event ID
  // The 'resource.id' or 'resource.reference' is the Transaction Reference
  const webhookEventId = payload.id || data.id;
  const transactionId = (
    resource.reference || 
    resource.transaction_reference || 
    resource.mpesa_receipt_number ||
    resource.system_reference ||
    resource.id || 
    data.id
  );

  // 8. Extract Sender Name
  const firstName = resource.sender_first_name || resource.first_name || resource.subscriber?.first_name || metadata.firstName || '';
  const lastName = resource.sender_last_name || resource.last_name || resource.subscriber?.last_name || metadata.lastName || '';
  const senderName = `${firstName} ${lastName}`.trim();

  // 9. Extract Order ID from metadata
  const orderId = (
    metadata.order_id || 
    metadata.orderId || 
    metadata.reference ||
    resource.external_reference
  );

  return {
    webhookEventId,
    transactionId,
    amount: parseFloat(String(amount || 0)),
    currency,
    phone,
    senderName,
    eventType,
    status,
    isSuccess,
    orderId,
    raw: payload
  };
};

/**
 * Sends an SMS notification to the customer after a successful transaction
 * as per Kopo Kopo API documentation.
 */
export const sendK2SmsNotification = async (webhookEventReference: string, message: string) => {
  try {
    const token = await getK2Token();
    const baseUrl = getK2BaseUrl();
    
    const response = await fetch(`${baseUrl}/api/v1/transaction_sms_notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'ReadMart/1.0.0 (https://readmartke.com)'
      },
      body: JSON.stringify({
        webhook_event_reference: webhookEventReference,
        message: message,
        _links: {
          callback_url: getK2CallbackUrl()
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('K2 SMS Notification Error:', errorText);
      return { success: false, error: errorText };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (err: any) {
    console.error('K2 SMS Notification Exception:', err);
    return { success: false, error: err.message };
  }
};
