import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, serverError, verifyJWT } from './_utils.js';
import { sendEmail, renderAbandonedCartEmail } from './_email.js';

export async function remindersHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    // 1. Authenticate and check for admin/founder role
    const authHeader = req.headers.authorization || '';
    const token = authHeader.split(' ')[1];
    
    // Debug logging for 401 investigation
    console.log('Reminders Auth Attempt - Header present:', !!authHeader);
    console.log('Reminders Auth Attempt - Token present:', !!token);

    if (!token) {
      console.warn('Reminders Auth Failed: No token provided in Authorization header');
      return json(res, 401, { error: 'Unauthorized', details: 'No token provided' });
    }

    // Try to get user from Supabase Auth
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    let user = userData?.user;

    // Fallback: If Supabase Auth fails, try custom JWT verification
    if (authError || !user) {
      console.warn('Supabase Auth getUser failed, trying custom JWT verify:', authError?.message);
      const decoded = await verifyJWT(req);
      if (decoded) {
        console.log('Custom JWT verification succeeded for:', decoded.email);
        // Mock user object for downstream logic
        user = { id: decoded.userId, email: decoded.email } as any;
      } else {
        console.error('Reminders Auth Error - Both Auth methods failed:', authError);
        return json(res, 401, { error: 'Unauthorized', details: authError?.message || 'Invalid token' });
      }
    }

    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      if (profileError.code === 'PGRST204' || profileError.message?.includes('cache')) {
        console.warn('Profiles schema cache issue in reminders, falling back to core selection');
        const { data: fallbackProfile, error: fallbackError } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', user.id)
          .maybeSingle();
        
        if (fallbackError) throw fallbackError;
        profile = fallbackProfile;
      } else {
        throw profileError;
      }
    }

    if (!profile || !['admin', 'founder'].includes(profile.role)) {
      return json(res, 403, { error: 'Forbidden' });
    }

    // 2. Identify abandoned carts
    // Criteria: Items in cart older than 24 hours, user hasn't received a reminder in 7 days
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // We'll fetch all cart items and their products with hardening
    let { data: cartItems, error: cartError } = await supabase
      .from('cart_items')
      .select(`
        user_id,
        quantity,
        product:products(id, title, price, sale_price),
        user:profiles(id, email, full_name, last_reminder_sent_at)
      `)
      .lt('created_at', twentyFourHoursAgo);

    if (cartError) {
      if (cartError.code === 'PGRST204' || cartError.message?.includes('cache')) {
        console.warn('Cart items schema cache issue, falling back to basic fetch');
        const { data: fallbackItems, error: fallbackError } = await supabase
          .from('cart_items')
          .select('user_id, quantity, product_id')
          .lt('created_at', twentyFourHoursAgo);
        
        if (fallbackError) throw fallbackError;

        // Enrich manually if join failed
        const enriched = await Promise.all((fallbackItems || []).map(async (item) => {
          try {
            const { data: product } = await supabase.from('products').select('id, title, price, sale_price').eq('id', item.product_id).maybeSingle();
            const { data: user } = await supabase.from('profiles').select('id, email, full_name, last_reminder_sent_at').eq('id', item.user_id).maybeSingle();
            return { ...item, product, user };
          } catch (e) {
            return item;
          }
        }));
        cartItems = enriched as any;
      } else {
        throw cartError;
      }
    }

    // 3. Group by user and filter those who need reminders
    const userCarts = new Map<string, any>();
    
    for (const item of (cartItems as any[]) || []) {
      const userData = Array.isArray(item.user) ? item.user[0] : item.user;
      const productData = Array.isArray(item.product) ? item.product[0] : item.product;
      
      if (!userData || !userData.email) continue;
      
      // Check if reminder was sent recently (e.g., within 7 days)
      if (userData.last_reminder_sent_at) {
        const lastSent = new Date(userData.last_reminder_sent_at).getTime();
        if (Date.now() - lastSent < 7 * 24 * 60 * 60 * 1000) continue;
      }

      if (!userCarts.has(userData.id)) {
        userCarts.set(userData.id, {
          user: userData,
          cartTotal: 0,
          items: []
        });
      }

      const cart = userCarts.get(userData.id);
      const price = productData.sale_price || productData.price;
      cart.cartTotal += price * item.quantity;
      cart.items.push(item);
    }

    // 4. Send emails
    let sentCount = 0;
    const errors = [];

    for (const [userId, cart] of userCarts.entries()) {
      try {
        const html = renderAbandonedCartEmail({ 
          user: cart.user, 
          cartTotal: cart.cartTotal 
        });

        await sendEmail({
          to: cart.user.email,
          subject: 'Forgot something? Your cart is waiting!',
          html
        });

        // Update last_reminder_sent_at with fallback
        try {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ last_reminder_sent_at: new Date().toISOString() })
            .eq('id', userId);
          
          if (updateError) {
            if (updateError.code === 'PGRST204' || updateError.message?.includes('cache')) {
              console.warn(`Could not update last_reminder_sent_at for ${userId} due to cache issue, skipping update`);
            } else {
              throw updateError;
            }
          }
        } catch (e) {
          console.warn(`Failed to update reminder timestamp for ${userId}:`, e);
        }

        sentCount++;
      } catch (err: any) {
        console.error(`Failed to send reminder to ${cart.user.email}:`, err);
        errors.push({ email: cart.user.email, error: err.message });
      }
    }

    return json(res, 200, { 
      success: true, 
      sentCount, 
      userCount: userCarts.size,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    return serverError(res, err);
  }
}
