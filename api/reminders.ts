import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, json, serverError, badRequest } from './_utils.ts';
import { sendEmail, renderAbandonedCartEmail } from './_email.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    // 1. Authenticate and check for admin/founder role
    const authHeader = req.headers.authorization || '';
    const token = authHeader.split(' ')[1];
    if (!token) return json(res, 401, { error: 'Unauthorized' });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return json(res, 401, { error: 'Unauthorized' });

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'founder'].includes(profile.role)) {
      return json(res, 403, { error: 'Forbidden' });
    }

    // 2. Identify abandoned carts
    // Criteria: Items in cart older than 24 hours, user hasn't received a reminder in 7 days
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // We'll fetch all cart items and their products
    const { data: cartItems, error: cartError } = await supabase
      .from('cart_items')
      .select(`
        user_id,
        quantity,
        product:products(id, title, price, sale_price),
        user:profiles(id, email, full_name, last_reminder_sent_at)
      `)
      .lt('created_at', twentyFourHoursAgo);

    if (cartError) throw cartError;

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

        // Update last_reminder_sent_at
        await supabase
          .from('profiles')
          .update({ last_reminder_sent_at: new Date().toISOString() })
          .eq('id', userId);

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
