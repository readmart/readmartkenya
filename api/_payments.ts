import crypto from 'crypto';
import { fetchWithTimeout } from './_utils.js';

const getK2Env = () => {
  if (process.env.KOPOKOPO_ENV) return process.env.KOPOKOPO_ENV;
  const isProduction =
    process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  return isProduction ? 'production' : 'sandbox';
};

const isProd = () =>
  process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

/**
 * Ensure required K2 environment variables are present.
 * In production this throws immediately with a clear message so we never
 * attempt to hit KopoKopo with a half-configured setup.
 */
const assertK2Config = (context: string) => {
  const missing: string[] = [];

  const clientId = (process.env.KOPOKOPO_CLIENT_ID || '').trim();
  const clientSecret = (process.env.KOPOKOPO_CLIENT_SECRET || '').trim();
  const apiKey = (process.env.KOPOKOPO_API_KEY || '').trim();
  const tillNumber = (process.env.KOPOKOPO_TILL_NUMBER || '').trim();

  if (!clientId) missing.push('KOPOKOPO_CLIENT_ID');
  if (!clientSecret) missing.push('KOPOKOPO_CLIENT_SECRET');
  if (!apiKey) missing.push('KOPOKOPO_API_KEY');
  if (!tillNumber) missing.push('KOPOKOPO_TILL_NUMBER');

  if (missing.length > 0) {
    const message = `K2 configuration error in ${context}: missing ${missing.join(
      ', ',
    )}. Please set these environment variables (see .env.example and DEPLOYMENT.md).`;

    if (isProd()) {
      // In production we fail fast – payments must be correctly configured.
      throw new Error(message);
    }

    // In non-production we warn loudly but allow the caller to decide what to do.
    console.warn(message);
  }
};

export const getK2BaseUrl = () => {
  if (process.env.KOPOKOPO_BASE_URL)
    return process.env.KOPOKOPO_BASE_URL.replace(/\/$/, '');
  return getK2Env() === 'production'
    ? 'https://api.kopokopo.com'
    : 'https://sandbox.kopokopo.com';
};

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
  orderId: string;
  phone: string;
  amount: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  currency?: string;
  callbackUrl?: string;
  customerId?: string;
  notes?: string;
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
async function fetchWithBackoff(url: string, options: any, retries = 1, backoff = 500) {
  const startTime = Date.now();
  try {
    // 10s timeout is safer for Vercel functions (default is 10s or 15s)
    const timeout = 10000;
    console.log(`[K2 Request] ${options.method || 'GET'} ${url} (Timeout: ${timeout}ms)`);
    
    const response = await fetchWithTimeout(url, options, timeout);
    const duration = Date.now() - startTime;
    console.log(`[K2 Response] ${response.status} ${url} (${duration}ms)`);
    
    if (response.status === 429 && retries > 0) {
      console.warn(`[K2 Rate Limited] 429 on ${url}. Retrying in ${backoff}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithBackoff(url, options, retries - 1, backoff * 2);
    }
    
    return response;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[K2 Error] ${error.name}: ${error.message} on ${url} after ${duration}ms`);
    
    if (retries > 0 && (error.name === 'AbortError' || error.message.includes('timeout'))) {
      console.warn(`[K2 Retry] Retrying after timeout on ${url}...`);
      return fetchWithBackoff(url, options, retries - 1, backoff);
    }
    throw error;
  }
}

export const getK2Token = async () => {
  // Validate base configuration up front
  assertK2Config('getK2Token');

  if (cachedToken && cachedToken.expiry > Date.now()) {
    return cachedToken.token;
  }

  const clientId = (process.env.KOPOKOPO_CLIENT_ID || '').trim();
  const clientSecret = (process.env.KOPOKOPO_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    const msg =
      'ReadMart Payments credentials (KOPOKOPO_CLIENT_ID, KOPOKOPO_CLIENT_SECRET) are not configured in environment variables';
    console.error('K2 Configuration Error:', msg);
    const error: Error & { code?: string } = new Error(msg);
    error.code = 'TOKEN_CONFIG_ERROR';
    throw error;
  }

  const authUrl = `${getK2AuthUrl()}/oauth/token`;
  console.log(`Fetching K2 token from ${authUrl}`);
  
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
    console.error(`K2 Token Error (Status ${response.status}):`, errorText);

    let detailedError = errorText;
    try {
      const json = JSON.parse(errorText);
      detailedError =
        json.error_description || json.message || json.error || errorText;
    } catch (e) {
      // fall through – non-JSON error body
    }

    const error: Error & { code?: string; status?: number } = new Error(
      `K2 Token Error (Status ${response.status}): ${detailedError}`,
    );
    error.code = 'TOKEN_RESPONSE_ERROR';
    error.status = response.status;
    throw error;
  }

  const data = (await response.json()) as { expires_in?: number; access_token: string };
  
  const expiresIn = data.expires_in || 3600;
  cachedToken = {
    token: data.access_token,
    expiry: Date.now() + (expiresIn - 600) * 1000, 
  };

  return data.access_token;
};

/**
 * Revokes an application access token as per jj.md L75
 */
export const revokeK2Token = async (tokenToRevoke: string) => {
  assertK2Config('revokeK2Token');
  const clientId = (process.env.KOPOKOPO_CLIENT_ID || '').trim();
  const clientSecret = (process.env.KOPOKOPO_CLIENT_SECRET || '').trim();

  const response = await fetchWithBackoff(`${getK2AuthUrl()}/oauth/revoke`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'ReadMart/1.0.0 (https://readmartke.com)',
      'Accept': 'application/json'
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      token: tokenToRevoke,
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`K2 Token Revocation Error (Status ${response.status}): ${errorText}`);
  }

  if (tokenToRevoke === cachedToken?.token) {
    cachedToken = null;
  }

  return { success: true };
};

/**
 * Introspects an access token to check validity as per jj.md L113
 */
export const introspectK2Token = async (tokenToIntrospect: string) => {
  assertK2Config('introspectK2Token');
  const clientId = (process.env.KOPOKOPO_CLIENT_ID || '').trim();
  const clientSecret = (process.env.KOPOKOPO_CLIENT_SECRET || '').trim();

  const response = await fetchWithBackoff(`${getK2AuthUrl()}/oauth/introspect`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'ReadMart/1.0.0 (https://readmartke.com)',
      'Accept': 'application/json'
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      token: tokenToIntrospect,
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`K2 Token Introspection Error (Status ${response.status}): ${errorText}`);
  }

  return await response.json();
};

/**
 * Gets info about an access token as per jj.md L157
 */
export const getK2TokenInfo = async (token: string) => {
  const response = await fetchWithBackoff(`${getK2AuthUrl()}/oauth/token/info`, {
    method: 'GET',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'ReadMart/1.0.0 (https://readmartke.com)',
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`K2 Token Info Error (Status ${response.status}): ${errorText}`);
  }

  return await response.json();
};

export const initiateK2StkPush = async (params: K2StkPushRequest) => {
  const token = await getK2Token();
  const apiKey = (process.env.KOPOKOPO_API_KEY || '').trim();
  const tillNumber = (process.env.KOPOKOPO_TILL_NUMBER || '').trim();

  if (!apiKey || !tillNumber) {
    console.error('K2 Configuration Error: Missing KOPOKOPO_API_KEY or KOPOKOPO_TILL_NUMBER');
    throw new Error('ReadMart Payments (K2) API key or Till Number is not configured in environment variables');
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
    payment_channel: 'M-PESA',
    till_number: tillNumber.startsWith('K') ? tillNumber : `K${tillNumber}`,
    subscriber: {
      first_name: params.firstName || 'ReadMart',
      last_name: params.lastName || 'Customer',
      phone_number: formattedPhone,
      email: params.email || '',
    },
    amount: {
      currency: params.currency || 'KES',
      value: Number(params.amount),
    },
    metadata: {
      order_id: params.orderId,
      customer_id: params.customerId || params.email || params.orderId,
      reference: params.orderId,
      notes: params.notes || `Order #${params.orderId.slice(0, 8).toUpperCase()}`
    },
    _links: {
      callback_url: params.callbackUrl || getK2CallbackUrl(params.orderId),
    },
  };

  console.log('Initiating K2 STK Push with payload:', JSON.stringify(payload, null, 2));

  const response = await fetchWithBackoff(`${getK2BaseUrl()}/api/v1/incoming_payments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'ReadMart/1.0.0 (https://readmartke.com)'
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`K2 STK Push API Error (Status ${response.status}):`, errorText);
    
    let parsedError = errorText;
    try {
      const jsonError = JSON.parse(errorText);
      parsedError = jsonError.message || jsonError.error || jsonError.description || errorText;
    } catch (e) {}
    
    throw new Error(`K2 STK Push Error (Status ${response.status}): ${parsedError}`);
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

/**
 * Lists all active K2 webhook subscriptions
 */
export const listK2Webhooks = async () => {
  const token = await getK2Token();
  const baseUrl = getK2BaseUrl();

  const commonHeaders: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'User-Agent': 'ReadMart/1.0.0 (https://readmartke.com)'
  };

  const response = await fetchWithBackoff(`${baseUrl}/api/v1/webhook_subscriptions`, {
    method: 'GET',
    headers: commonHeaders
  });

  if (!response.ok) {
    if (response.status === 404) {
      const fallbackResponse = await fetchWithBackoff(`${baseUrl}/api/v1/webhook-subscriptions`, {
        method: 'GET',
        headers: commonHeaders
      });
      if (fallbackResponse.ok) return await fallbackResponse.json();
    }
    const errorText = await response.text();
    throw new Error(`Failed to list K2 webhooks (Status ${response.status}): ${errorText}`);
  }

  return await response.json();
};

/**
 * Initiates a settlement transfer as per jj.md L1357 (blind) or L1400 (targeted)
 */
export const initiateK2SettlementTransfer = async (params: {
  amount?: { currency: string; value: number };
  destination_type?: 'merchant_bank_account' | 'merchant_wallet';
  destination_reference?: string;
  callbackUrl?: string;
}) => {
  const token = await getK2Token();
  const baseUrl = getK2BaseUrl();

  const payload: any = {
    _links: {
      callback_url: params.callbackUrl || getK2CallbackUrl()
    }
  };

  if (params.amount) payload.amount = params.amount;
  if (params.destination_type) payload.destination_type = params.destination_type;
  if (params.destination_reference) payload.destination_reference = params.destination_reference;

  const response = await fetchWithBackoff(`${baseUrl}/api/v1/settlement_transfers`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'ReadMart/1.0.0 (https://readmartke.com)'
    },
    body: JSON.stringify(payload)
  });

  if (response.status === 201) {
    const location = response.headers.get('location');
    return { success: true, location };
  }

  const errorText = await response.text();
  console.error(`K2 Settlement Transfer Error (Status ${response.status}):`, errorText);
  return { success: false, status: response.status, error: errorText };
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
  TRANSACTION_SMS_NOTIFICATION: 'transaction_sms_notification',
  B2C_PAYMENT_SUCCESS: 'b2c_payment_success',
  B2C_PAYMENT_FAILED: 'b2c_payment_failed',
  PAYMENT_RESULT: 'payment_result'
};

/**
 * Adds a PAY recipient as per Kopo Kopo documentation.
 * Supported types: mobile_wallet, bank_account, till, paybill
 */
export const createK2PayRecipient = async (params: {
  type: 'mobile_wallet' | 'bank_account' | 'till' | 'paybill';
  pay_recipient: any;
}) => {
  try {
    const token = await getK2Token();
    const baseUrl = getK2BaseUrl();

    // Normalize our internal payload shape to K2's expected JSON fields.
    const pr = params.pay_recipient || {};
    let body: any = { ...params };

    if (params.type === 'mobile_wallet') {
      body = {
        type: 'mobile_wallet',
        pay_recipient: {
          first_name: pr.first_name || pr.firstName,
          last_name: pr.last_name || pr.lastName,
          email: pr.email,
          phone_number: pr.phone_number || pr.phone,
          network: pr.network,
        },
      };
    } else if (params.type === 'bank_account') {
      body = {
        type: 'bank_account',
        pay_recipient: {
          account_name: pr.account_name || pr.accountName,
          bank_branch_ref: pr.bank_branch_ref || pr.bankBranchRef,
          account_number: pr.account_number || pr.accountNumber,
          settlement_method: pr.settlement_method || pr.settlementMethod || 'RTS',
        },
      };
    } else if (params.type === 'till') {
      body = {
        type: 'till',
        pay_recipient: {
          till_name: pr.till_name || pr.tillName,
          till_number: pr.till_number || pr.tillNumber,
        },
      };
    } else if (params.type === 'paybill') {
      body = {
        type: 'paybill',
        pay_recipient: {
          paybill_name: pr.paybill_name || pr.paybillName,
          paybill_number: pr.paybill_number || pr.paybillNumber,
          paybill_account_number:
            pr.paybill_account_number || pr.paybillAccountNumber,
        },
      };
    }

    const response = await fetchWithBackoff(`${baseUrl}/api/v1/pay_recipients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'ReadMart/1.0.0 (https://readmartke.com)',
      },
      body: JSON.stringify(body),
    });

    if (response.status === 201) {
      const location = response.headers.get('location');
      return { success: true, location };
    }

    const errorText = await response.text();
    console.error(`K2 Create Pay Recipient Error (Status ${response.status}):`, errorText);
    return { success: false, status: response.status, error: errorText };
  } catch (err: any) {
    console.error('K2 Create Pay Recipient Exception:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Initiates an outgoing payment (PAY) as per Kopo Kopo documentation.
 */
export const initiateK2Payment = async (params: {
  destination_type: 'mobile_wallet' | 'bank_account' | 'till' | 'paybill';
  destination_reference: string;
  amount: { currency: string; value: number };
  description: string;
  category?: string;
  tags?: string[];
  metadata?: Record<string, string>;
  callbackUrl?: string;
}) => {
  try {
    const token = await getK2Token();
    const baseUrl = getK2BaseUrl();

  const payload = {
    amount: {
      currency: params.amount.currency,
      value: params.amount.value,
    },
    description: params.description,
    category: params.category,
    tags: params.tags,
    metadata: params.metadata,
    _links: {
      callback_url: params.callbackUrl || getK2CallbackUrl(),
    },
    destination_type: params.destination_type,
    destination_reference: params.destination_reference,
  };

    const response = await fetchWithBackoff(`${baseUrl}/api/v1/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'ReadMart/1.0.0 (https://readmartke.com)'
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 201) {
      const location = response.headers.get('location');
      return { success: true, location };
    }

    const errorText = await response.text();
    console.error(`K2 Initiate Payment Error (Status ${response.status}):`, errorText);
    return { success: false, status: response.status, error: errorText };
  } catch (err: any) {
    console.error('K2 Initiate Payment Exception:', err);
    return { success: false, error: err.message };
  }
};

export const getK2TransactionStatus = async (transactionId: string) => {
  const token = await getK2Token();
  
  // Try incoming_payments first (standard for STK Push)
  const response = await fetchWithBackoff(`${getK2BaseUrl()}/api/v1/incoming_payments/${transactionId}`, {
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

export const verifyK2Signature = (rawBody: string, signature: string | undefined | null) => {
  // Per KopoKopo docs, the HMAC key MUST be the API key (or a dedicated webhook secret).
  const secret = (
    process.env.KOPOKOPO_WEBHOOK_SECRET || // preferred explicit secret
    process.env.KOPOKOPO_API_KEY ||        // fallback to API key as documented
    ''
  ).trim();

  if (!secret || !signature) {
    console.warn(
      'Missing KOPOKOPO_API_KEY/KOPOKOPO_WEBHOOK_SECRET or signature for verification',
    );
    return false;
  }

  try {
    const bodyString = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
    const hashHex = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');

    // K2 examples use hex signatures; we support both hex and base64 just in case.
    if (hashHex === signature) return true;

    const hashBase64 = crypto
      .createHmac('sha256', secret)
      .update(bodyString)
      .digest('base64');
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
    'Success', 'Completed', 'Received', 'success', 'Transferred', 'Processed', 'Incoming Payment Request', 'Complete'
  ].includes(status);

  // 5. Extract Amount (can be object {value, currency} or direct string)
  const amountObj = resource.amount || data.amount || payload.amount || {};
  let amount = typeof amountObj === 'object' ? (amountObj.value || amountObj.amount) : amountObj;
  
  // Handle string amounts directly (as in the sample payload)
  if (!amount && typeof resource.amount === 'string') {
    amount = resource.amount;
  }
  
  // Handle amount object in STK Push result (v1)
  if (!amount && payload.amount) {
    amount = payload.amount.value || payload.amount.amount;
  }
  
  const currency = typeof amountObj === 'object' ? (amountObj.currency) : (resource.currency || data.currency || payload.currency || 'KES');
  
  // 6. Extract Phone Number or Card Number
  const phone = (
    resource.sender_phone_number || 
    resource.phone_number || 
    resource.subscriber?.phone_number || 
    payload.phone_number ||
    payload.subscriber?.phone_number ||
    metadata.phone ||
    metadata.phoneNumber ||
    resource.sender_msisdn ||
    resource.sending_till // B2B
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
  const firstName = resource.sender_first_name || resource.first_name || resource.subscriber?.first_name || payload.first_name || payload.subscriber?.first_name || metadata.firstName || '';
  const lastName = resource.sender_last_name || resource.last_name || resource.subscriber?.last_name || payload.last_name || payload.subscriber?.last_name || metadata.lastName || '';
  const senderName = (resource.till_name || resource.sending_till) ? (resource.till_name || `Till ${resource.sending_till}`) : `${firstName} ${lastName}`.trim();

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
    
    // K2 docs require a callback URL for the result
    const callbackUrl = getK2CallbackUrl();

    console.log(`Sending K2 SMS Notification for event ${webhookEventReference} to ${baseUrl}`);

    const response = await fetch(`${baseUrl}/api/v1/transaction_sms_notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'ReadMart/1.0.0 (https://readmartke.com)'
      },
      body: JSON.stringify({
        webhook_event_id: webhookEventReference, // K2 v1 uses webhook_event_id
        message: message,
        _links: {
          callback_url: callbackUrl
        }
      })
    });

    if (response.status === 201) {
      const location = response.headers.get('location');
      let data = {};
      try {
        const text = await response.text();
        if (text) data = JSON.parse(text);
      } catch (e) {
        // Body might be empty, which is fine for 201
      }
      return { success: true, location, data };
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`K2 SMS Notification Error (Status ${response.status}):`, errorText);
      
      let errorData = { error_message: errorText };
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {}
      
      return { 
        success: false, 
        status: response.status,
        error: errorData.error_message || errorText 
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (err: any) {
    console.error('K2 SMS Notification Exception:', err);
    return { success: false, error: err.message };
  }
};
