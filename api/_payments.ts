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
  const response = await fetchWithBackoff(`${getK2BaseUrl()}/api/v1/incoming_payments/${transactionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'ReadMart/1.0.0 (https://readmartke.com)'
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get K2 transaction status: ${errorText}`);
  }

  return await response.json();
};

export const verifyK2Signature = (payload: unknown, signature: string) => {
  const apiKey = (process.env.KOPOKOPO_API_KEY || '').trim();
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  
  if (!apiKey) {
    console.warn('KOPOKOPO_API_KEY is not set.');
    // In production, we MUST have the API key for security
    return !isProduction; 
  }
  
  if (!signature) return false;

  const bodyString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const hash = crypto.createHmac('sha256', apiKey).update(bodyString).digest('hex');

  // Use timingSafeEqual if possible, but it requires Buffer of equal length
  try {
    const signatureBuffer = Buffer.from(signature);
    const hashBuffer = Buffer.from(hash);
    if (signatureBuffer.length !== hashBuffer.length) return false;
    return crypto.timingSafeEqual(signatureBuffer, hashBuffer);
  } catch (e) {
    // Fallback to standard comparison if buffers can't be created
    return hash === signature;
  }
};

export const extractK2WebhookData = (payload: any) => {
  const data = payload.data?.attributes || payload.attributes || payload;
  const event = payload.data?.attributes?.event || data.event || payload.event || {};
  const resource = event.resource || data.resource || payload.resource || {};
  const metadata = data.metadata || payload.metadata || resource.metadata || {};

  // Log for debugging if needed
  // console.log('Extracting data from payload:', JSON.stringify({ data, event, resource, metadata }));

  const status = (
    data.status || 
    resource.status || 
    payload.status || 
    (data.state === 'success' ? 'Success' : data.state)
  );

  const isSuccess = (
    status === 'Success' || 
    status === 'Completed' || 
    status === 'Received' ||
    status === 'success'
  );

  const amountObj = resource.amount || data.amount || payload.amount || {};
  const amount = typeof amountObj === 'object' ? amountObj.value : amountObj;
  
  const phone = (
    resource.phone_number || 
    resource.sender_phone_number || 
    resource.subscriber?.phone_number || 
    metadata.phone ||
    metadata.phone_number
  );

  const transactionId = (
    resource.transaction_id || 
    resource.id || 
    payload.id || 
    resource.system_id ||
    data.id
  );

  const orderId = (
    metadata.order_id || 
    metadata.customer_reference || 
    metadata.reference ||
    resource.reference ||
    resource.external_reference ||
    resource.system_reference ||
    (resource.metadata ? (resource.metadata.order_id || resource.metadata.reference) : null) ||
    data.reference
  );

  const eventType = (
    payload.data?.type || 
    event.type || 
    data.type || 
    payload.type
  );

  const senderName = (
    resource.sender_first_name 
      ? `${resource.sender_first_name} ${resource.sender_last_name || ''}`.trim() 
      : (resource.first_name ? `${resource.first_name} ${resource.last_name || ''}`.trim() : null)
  );

  return {
    transactionId,
    orderId,
    isSuccess,
    amount,
    phone,
    eventType,
    senderName,
    status,
    rawResource: resource
  };
};
