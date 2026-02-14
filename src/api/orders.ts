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
    total_amount: (orderData.subtotal_amount || 0) + (orderData.shipping_amount || 0),
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

  // Define a set of "new" columns that are prone to schema cache issues
  const potentialProblematicColumns = [
    'shipping_amount', 
    'subtotal_amount', 
    'tax_amount', 
    'total_amount', 
    'shipping_zone_id',
    'metadata' // Added metadata here as it's causing PGRST204 errors
  ];

  // AGGRESSIVE BYPASS: Use resilient insertion pattern
  // This handles schema cache issues by filtering problematic columns on failure
  
  let currentInsertData = { ...orderInsertData };
  let order = null;
  let lastError = null;
  let attempts = 0;
  const maxAttempts = potentialProblematicColumns.length + 2; 

  while (attempts < maxAttempts) {
    attempts++;
    console.log(`Order creation attempt ${attempts}... Data keys: ${Object.keys(currentInsertData).join(', ')}`);
    
    // EXPLICITLY use .select('id')
    const { data, error } = await supabase
      .from('orders')
      .insert({ ...currentInsertData })
      .select('id')
      .maybeSingle();

    if (!error && data) {
      console.log('Order created successfully on attempt', attempts);
      order = data;
      break;
    }

    lastError = error;
    console.warn(`Order creation attempt ${attempts} failed:`, error?.code, error?.message);

    const isSchemaError = 
      error?.code === 'PGRST204' || 
      error?.message?.toLowerCase().includes('column') || 
      error?.message?.toLowerCase().includes('cache') ||
      error?.message?.toLowerCase().includes('not found');

    if (isSchemaError) {
      // If we've already tried several times and still getting schema errors, 
      // let's try a very aggressive approach by removing ALL known problematic columns immediately
      if (attempts >= 2) {
        console.warn('Persistent schema error detected. Switching to aggressive column filtering.');
        for (const col of potentialProblematicColumns) {
          if (currentInsertData[col] !== undefined) {
            // Only try to move to metadata if the column we are removing IS NOT metadata
            if (col !== 'metadata') {
              currentInsertData.metadata = {
                ...(currentInsertData.metadata || {}),
                [`aggressive_fallback_${col}`]: currentInsertData[col]
              };
            }
            delete currentInsertData[col];
          }
        }
        continue;
      }

      // 1. Try to extract the problematic column name from the error message
      // Message format: "Could not find the 'column_name' column of 'table_name' in the schema cache"
      const match = error?.message?.match(/['"]([^'"]+)['"]/); // Match anything inside quotes
      let problematicColumn = match ? match[1] : null;

      // Fallback: search for the column name in the error message if quotes didn't work
      if (!problematicColumn && error?.message?.includes('shipping_amount')) problematicColumn = 'shipping_amount';
      if (!problematicColumn && error?.message?.includes('subtotal_amount')) problematicColumn = 'subtotal_amount';
      if (!problematicColumn && error?.message?.includes('tax_amount')) problematicColumn = 'tax_amount';
      if (!problematicColumn && error?.message?.includes('total_amount')) problematicColumn = 'total_amount';
      if (!problematicColumn && error?.message?.includes('shipping_zone_id')) problematicColumn = 'shipping_zone_id';

      if (problematicColumn && currentInsertData[problematicColumn] !== undefined) {
        console.warn(`Schema cache issue detected for specific column: ${problematicColumn}. Omiting and retrying...`);
        
        // Only try to move to metadata if the problematic column IS NOT metadata itself
        if (problematicColumn !== 'metadata') {
          currentInsertData.metadata = {
            ...(currentInsertData.metadata || {}),
            [problematicColumn]: currentInsertData[problematicColumn],
            schema_fallback: true,
            fallback_at: new Date().toISOString()
          };
        }
        
        delete currentInsertData[problematicColumn];
        continue; 
      } 
      
      // 2. If we couldn't identify a specific column, or the identified one was already removed, 
      // try removing columns from our known "problematic" list one by one
      let removedSomething = false;
      for (const col of potentialProblematicColumns) {
        if (currentInsertData[col] !== undefined) {
          console.warn(`Removing potential problematic column: ${col} and retrying...`);
          
          // Only move to metadata if the column we are removing IS NOT metadata
          if (col !== 'metadata') {
            currentInsertData.metadata = {
              ...(currentInsertData.metadata || {}),
              [`fallback_${col}`]: currentInsertData[col],
              schema_fallback_generic: true
            };
          }
          
          delete currentInsertData[col];
          removedSomething = true;
          break; // Try again after removing one
        }
      }

      if (removedSomething) continue;

      // 3. ULTIMATE FALLBACK: Remove ALL non-core columns
      console.error('All specific column removals failed. Attempting ultimate fallback with core columns only.');
      const coreColumns = ['user_id', 'shipping_address', 'status', 'payment_method'];
      const minimalData: any = {};
      
      // Only include metadata if it's NOT in our list of problematic columns 
      // or if we haven't identified it as missing yet
      const includeMetadata = !potentialProblematicColumns.includes('metadata') || (currentInsertData.metadata && !error?.message?.includes('metadata'));
      
      if (includeMetadata) {
        const metadataBackup: any = { ...(currentInsertData.metadata || {}), absolute_fallback: true };
        Object.keys(currentInsertData).forEach(key => {
          if (coreColumns.includes(key)) {
            minimalData[key] = currentInsertData[key];
          } else if (key !== 'metadata') {
            metadataBackup[`final_fallback_${key}`] = currentInsertData[key];
          }
        });
        minimalData.metadata = metadataBackup;
      } else {
        Object.keys(currentInsertData).forEach(key => {
          if (coreColumns.includes(key)) {
            minimalData[key] = currentInsertData[key];
          }
        });
      }
      
      const { data: finalData, error: finalError } = await supabase
        .from('orders')
        .insert(minimalData)
        .select('id')
        .maybeSingle();
      
      if (!finalError && finalData) {
        order = finalData;
        break;
      }
      lastError = finalError;
      break; // Give up
    } else {
      // Not a schema error (e.g., RLS, validation), don't retry
      break;
    }
  }

  if (lastError && !order) {
    console.error('Final order creation error after all fallbacks:', lastError);
    throw lastError;
  }

  if (!order) throw new Error('Order creation failed');

  // 2. Create order items with resilience
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
    const isSchemaError = 
      itemsError.code === 'PGRST204' || 
      itemsError.message?.toLowerCase().includes('cache') || 
      itemsError.message?.toLowerCase().includes('column') ||
      itemsError.message?.toLowerCase().includes('not found');

    if (isSchemaError) {
       console.warn('Schema cache issue on order_items, retrying with minimal payload');
       // Try a minimal insert for items as well if needed
       // Remove product_snapshot as it's the most likely "new" column causing issues
       const minimalItems = orderItems.map(({ product_snapshot, price, ...rest }) => ({
         ...rest,
         // Ensure we use price_at_purchase as it's the core column
         price_at_purchase: price 
       }));

       const { error: retryError } = await supabase
         .from('order_items')
         .insert(minimalItems);
       
       if (retryError) {
         console.error('Final order items creation error after fallback:', retryError);
         // If it still fails, try one more time with JUST core columns (order_id, product_id, quantity)
         const absoluteMinimalItems = orderItems.map(({ order_id, product_id, quantity }) => ({
           order_id, product_id, quantity
         }));
         const { error: absoluteRetryError } = await supabase
           .from('order_items')
           .insert(absoluteMinimalItems);
         
         if (absoluteRetryError) throw absoluteRetryError;
       }
    } else {
      throw itemsError;
    }
  }

  return order;
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
      id, user_id, status, total_amount, subtotal_amount, shipping_amount, tax_amount, 
      shipping_address, payment_method, payment_status, created_at,
      items:order_items(
        id, order_id, product_id, quantity, price_at_purchase, product_snapshot,
        product:products(id, title, image_url, type, metadata)
      )
    `)
    .eq('id', orderId);

  // If not admin, restrict to own orders
  if (profile?.role !== 'admin' && profile?.role !== 'founder') {
    query.eq('user_id', user?.id);
  }

  const { data, error } = await query
    .maybeSingle();
  
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
