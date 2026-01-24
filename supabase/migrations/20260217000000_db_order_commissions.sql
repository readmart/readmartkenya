-- ==========================================
-- Migration: Database Order Commissions & Ledger Automation
-- Target: orders, fulfillment_ledger, partnership_services
-- Description: Implements backend commission calculation to ensure logistics and author payouts are tracked automatically.
-- ==========================================

BEGIN;

-- 1. Function to calculate commissions for an order
CREATE OR REPLACE FUNCTION public.calculate_order_commissions(p_order_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_order_record RECORD;
    v_item RECORD;
    v_platform_service_id uuid;
    v_logistics_service_id uuid;
    v_author_service_id uuid;
    v_platform_rate decimal;
    v_author_rate decimal;
    v_logistics_partner_id uuid;
    v_ledger_entries_count integer := 0;
    v_item_amount decimal;
    v_commission_amount decimal;
    v_author_amount decimal;
BEGIN
    -- 1. Get order details
    SELECT * INTO v_order_record FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Order not found');
    END IF;

    -- 2. Prevent duplicate calculation
    IF EXISTS (SELECT 1 FROM public.fulfillment_ledger WHERE order_id = p_order_id) THEN
        RETURN jsonb_build_object('status', 'success', 'message', 'Commissions already calculated for this order');
    END IF;

    -- 3. Get service IDs and rates
    SELECT id, COALESCE(commission_rate, 10.00) INTO v_platform_service_id, v_platform_rate 
    FROM public.partnership_services 
    WHERE name ILIKE '%platform%' OR name ILIKE '%readmart%' 
    LIMIT 1;

    SELECT id INTO v_logistics_service_id 
    FROM public.partnership_services 
    WHERE name ILIKE '%logistics%' OR name ILIKE '%shipping%' 
    LIMIT 1;

    SELECT id INTO v_author_service_id 
    FROM public.partnership_services 
    WHERE name ILIKE '%author%' OR name ILIKE '%royalty%' 
    LIMIT 1;

    SELECT COALESCE(author_commission_rate, 70.00) INTO v_author_rate 
    FROM public.site_settings 
    WHERE id = 'global' 
    LIMIT 1;

    -- 4. Calculate Logistics Payout
    IF v_order_record.shipping_zone_id IS NOT NULL AND v_order_record.shipping_amount > 0 THEN
        SELECT partner_id INTO v_logistics_partner_id 
        FROM public.shipping_zones 
        WHERE id = v_order_record.shipping_zone_id;

        IF v_logistics_partner_id IS NOT NULL THEN
            INSERT INTO public.fulfillment_ledger (order_id, partner_id, partner_service_id, amount, metadata)
            VALUES (
                p_order_id, 
                v_logistics_partner_id, 
                v_logistics_service_id, 
                v_order_record.shipping_amount, 
                jsonb_build_object('type', 'logistics_fulfillment', 'zone_id', v_order_record.shipping_zone_id)
            );
            v_ledger_entries_count := v_ledger_entries_count + 1;
        END IF;
    END IF;

    -- 5. Calculate Item-based commissions (Platform & Author)
    FOR v_item IN SELECT oi.*, p.author_id as product_author_id 
                  FROM public.order_items oi
                  LEFT JOIN public.products p ON oi.product_id = p.id
                  WHERE oi.order_id = p_order_id
    LOOP
        v_item_amount := v_item.price_at_purchase * v_item.quantity;
        
        -- 5.1 Platform Commission
        v_commission_amount := v_item_amount * (v_platform_rate / 100);
        INSERT INTO public.fulfillment_ledger (order_id, partner_service_id, amount, metadata)
        VALUES (
            p_order_id, 
            v_platform_service_id, 
            v_commission_amount, 
            jsonb_build_object('type', 'platform_commission', 'item_id', v_item.product_id, 'rate', v_platform_rate)
        );
        v_ledger_entries_count := v_ledger_entries_count + 1;

        -- 5.2 Author Payout
        IF v_item.product_author_id IS NOT NULL THEN
            v_author_amount := v_item_amount * (v_author_rate / 100);
            INSERT INTO public.fulfillment_ledger (order_id, partner_id, partner_service_id, amount, metadata)
            VALUES (
                p_order_id, 
                v_item.product_author_id, 
                v_author_service_id, 
                v_author_amount, 
                jsonb_build_object('type', 'author_royalty', 'item_id', v_item.product_id, 'rate', v_author_rate)
            );
            v_ledger_entries_count := v_ledger_entries_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'status', 'success', 
        'message', 'Commissions calculated', 
        'entries_created', v_ledger_entries_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger to automatically calculate commissions when an order is paid
CREATE OR REPLACE FUNCTION public.tr_handle_order_paid()
RETURNS TRIGGER AS $$
BEGIN
    -- Fire only when is_paid changes from false to true
    IF NEW.is_paid = true AND (OLD.is_paid = false OR OLD.is_paid IS NULL) THEN
        PERFORM public.calculate_order_commissions(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_order_paid_commissions ON public.orders;
CREATE TRIGGER tr_order_paid_commissions
    AFTER UPDATE OF is_paid ON public.orders
    FOR EACH ROW
    EXECUTE PROCEDURE public.tr_handle_order_paid();

COMMIT;
