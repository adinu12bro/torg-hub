
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.role_rank(public.app_role) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.max_role_rank(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_min_role(public.app_role) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM public, anon, authenticated;

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_select ON public.audit_logs FOR SELECT TO authenticated USING (public.has_min_role('manager'));
CREATE POLICY audit_insert ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_staff() AND user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.log_audit(_action text, _resource_type text, _resource_id uuid, _prev jsonb, _new jsonb, _reason text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.audit_logs(user_id, action, resource_type, resource_id, previous_value, new_value, reason)
  VALUES (auth.uid(), _action, _resource_type, _resource_id, _prev, _new, _reason);
$$;
REVOKE EXECUTE ON FUNCTION public.log_audit(text,text,uuid,jsonb,jsonb,text) FROM public, anon, authenticated;

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  body text,
  severity text NOT NULL DEFAULT 'info',
  resource_type text,
  resource_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_select ON public.notifications FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY notif_write ON public.notifications FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ============ INVENTORY MOVEMENTS ============
CREATE TYPE public.movement_type AS ENUM ('receive','sale','adjustment','damage','loss','return','transfer','count','initial');

CREATE TABLE public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  previous_qty integer NOT NULL,
  qty_change integer NOT NULL,
  new_qty integer NOT NULL,
  movement_type public.movement_type NOT NULL,
  reason text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sale_id uuid,
  purchase_id uuid,
  return_id uuid,
  stock_count_id uuid,
  unit_cost numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mov_variant ON public.inventory_movements(variant_id);
CREATE INDEX idx_mov_created ON public.inventory_movements(created_at DESC);
GRANT SELECT ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY mov_select ON public.inventory_movements FOR SELECT TO authenticated USING (public.is_staff());

-- ============ SUPPLIERS / PURCHASES ============
CREATE TYPE public.purchase_status AS ENUM ('draft','confirmed','cancelled');
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  reference_no text,
  purchase_date date NOT NULL DEFAULT current_date,
  status public.purchase_status NOT NULL DEFAULT 'draft',
  total_cost numeric(14,2) NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  buy_price numeric(12,2) NOT NULL CHECK (buy_price >= 0),
  line_total numeric(14,2) NOT NULL DEFAULT 0
);
CREATE INDEX idx_pitems_purchase ON public.purchase_items(purchase_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchases TO service_role;
GRANT ALL ON public.purchase_items TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchases_select ON public.purchases FOR SELECT TO authenticated USING (public.has_min_role('manager'));
CREATE POLICY purchases_write ON public.purchases FOR ALL TO authenticated USING (public.has_min_role('admin')) WITH CHECK (public.has_min_role('admin'));
CREATE POLICY pitems_select ON public.purchase_items FOR SELECT TO authenticated USING (public.has_min_role('manager'));
CREATE POLICY pitems_write ON public.purchase_items FOR ALL TO authenticated USING (public.has_min_role('admin')) WITH CHECK (public.has_min_role('admin'));
CREATE TRIGGER t_purchases_updated BEFORE UPDATE ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SALES ============
CREATE TYPE public.sale_status AS ENUM ('completed','cancelled');
CREATE TYPE public.payment_status AS ENUM ('paid','partial','unpaid','credit');

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_no bigint GENERATED BY DEFAULT AS IDENTITY UNIQUE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  subtotal numeric(14,2) NOT NULL DEFAULT 0,
  discount numeric(14,2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  revenue numeric(14,2) NOT NULL DEFAULT 0,
  cost numeric(14,2) NOT NULL DEFAULT 0,
  profit numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  payment_status public.payment_status NOT NULL DEFAULT 'unpaid',
  status public.sale_status NOT NULL DEFAULT 'completed',
  due_date date,
  notes text,
  idempotency_key text UNIQUE,
  staff_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sales_customer ON public.sales(customer_id);
CREATE INDEX idx_sales_created ON public.sales(created_at DESC);

CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  variant_label text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  line_revenue numeric(14,2) NOT NULL DEFAULT 0,
  line_cost numeric(14,2) NOT NULL DEFAULT 0,
  line_profit numeric(14,2) NOT NULL DEFAULT 0,
  returned_qty integer NOT NULL DEFAULT 0 CHECK (returned_qty >= 0)
);
CREATE INDEX idx_sitems_sale ON public.sale_items(sale_id);
CREATE INDEX idx_sitems_variant ON public.sale_items(variant_id);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES public.sales(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL CHECK (amount <> 0),
  method text NOT NULL DEFAULT 'Cash',
  reference text,
  note text,
  received_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_sale ON public.payments(sale_id);

CREATE TABLE public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  reason text,
  refund_amount numeric(14,2) NOT NULL DEFAULT 0,
  refund_method text NOT NULL DEFAULT 'Cash',
  cost_reversed numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
  sale_item_id uuid NOT NULL REFERENCES public.sale_items(id) ON DELETE RESTRICT,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE ON public.sales TO authenticated;
GRANT SELECT, INSERT ON public.sale_items TO authenticated;
GRANT SELECT, INSERT ON public.payments TO authenticated;
GRANT SELECT, INSERT ON public.payment_allocations TO authenticated;
GRANT SELECT, INSERT ON public.returns TO authenticated;
GRANT SELECT, INSERT ON public.return_items TO authenticated;
GRANT ALL ON public.sales, public.sale_items, public.payments, public.payment_allocations, public.returns, public.return_items TO service_role;

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY sales_select ON public.sales FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY sales_update ON public.sales FOR UPDATE TO authenticated USING (public.has_min_role('manager')) WITH CHECK (public.has_min_role('manager'));
CREATE POLICY sitems_select ON public.sale_items FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY payments_select ON public.payments FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY payments_insert ON public.payments FOR INSERT TO authenticated WITH CHECK (public.is_staff() AND received_by = auth.uid());
CREATE POLICY alloc_select ON public.payment_allocations FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY returns_select ON public.returns FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY ritems_select ON public.return_items FOR SELECT TO authenticated USING (public.is_staff());
CREATE TRIGGER t_sales_updated BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ STOCK COUNTS ============
CREATE TYPE public.count_status AS ENUM ('open','pending_approval','approved','rejected');
CREATE TABLE public.stock_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status public.count_status NOT NULL DEFAULT 'open',
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.stock_count_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_count_id uuid NOT NULL REFERENCES public.stock_counts(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  system_qty integer NOT NULL DEFAULT 0,
  physical_qty integer,
  difference integer GENERATED ALWAYS AS (COALESCE(physical_qty,0) - system_qty) STORED,
  note text,
  UNIQUE (stock_count_id, variant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_counts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_count_items TO authenticated;
GRANT ALL ON public.stock_counts, public.stock_count_items TO service_role;
ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_count_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY sc_select ON public.stock_counts FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY sc_write ON public.stock_counts FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY sci_select ON public.stock_count_items FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY sci_write ON public.stock_count_items FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE TRIGGER t_sc_updated BEFORE UPDATE ON public.stock_counts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ EXPENSES ============
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  expense_date date NOT NULL DEFAULT current_date,
  description text,
  payment_method text NOT NULL DEFAULT 'Cash',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expenses_date ON public.expenses(expense_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY expenses_select ON public.expenses FOR SELECT TO authenticated USING (public.has_min_role('manager'));
CREATE POLICY expenses_write ON public.expenses FOR ALL TO authenticated USING (public.has_min_role('admin')) WITH CHECK (public.has_min_role('admin'));
CREATE TRIGGER t_expenses_updated BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ CORE STOCK ENGINE ============
CREATE OR REPLACE FUNCTION public.apply_stock_change(
  _variant_id uuid, _qty_change integer, _type public.movement_type, _reason text,
  _sale_id uuid DEFAULT NULL, _purchase_id uuid DEFAULT NULL, _return_id uuid DEFAULT NULL,
  _stock_count_id uuid DEFAULT NULL, _unit_cost numeric DEFAULT NULL
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE prev int; nxt int; pid uuid; allow_neg boolean;
BEGIN
  SELECT stock, product_id INTO prev, pid FROM public.product_variants WHERE id = _variant_id FOR UPDATE;
  IF prev IS NULL THEN RAISE EXCEPTION 'Variant not found'; END IF;
  nxt := prev + _qty_change;
  SELECT COALESCE((value->>'allow_negative_stock')::boolean, false) INTO allow_neg FROM public.settings WHERE key = 'inventory';
  IF nxt < 0 AND NOT COALESCE(allow_neg, false) THEN
    RAISE EXCEPTION 'Insufficient stock for variant % (have %, need %)', _variant_id, prev, abs(_qty_change);
  END IF;
  UPDATE public.product_variants SET stock = nxt WHERE id = _variant_id;
  INSERT INTO public.inventory_movements(variant_id, product_id, previous_qty, qty_change, new_qty, movement_type, reason, user_id, sale_id, purchase_id, return_id, stock_count_id, unit_cost)
  VALUES (_variant_id, pid, prev, _qty_change, nxt, _type, _reason, auth.uid(), _sale_id, _purchase_id, _return_id, _stock_count_id, _unit_cost);
  RETURN nxt;
END; $$;
REVOKE EXECUTE ON FUNCTION public.apply_stock_change(uuid,integer,public.movement_type,text,uuid,uuid,uuid,uuid,numeric) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.adjust_stock(_variant_id uuid, _qty_change integer, _type public.movement_type, _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nxt int;
BEGIN
  IF NOT public.has_min_role('manager') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) = 0 THEN RAISE EXCEPTION 'Reason is required'; END IF;
  nxt := public.apply_stock_change(_variant_id, _qty_change, _type, _reason);
  PERFORM public.log_audit('stock_adjust','product_variant',_variant_id, jsonb_build_object('change',_qty_change), jsonb_build_object('new_qty',nxt), _reason);
  RETURN nxt;
END; $$;
REVOKE EXECUTE ON FUNCTION public.adjust_stock(uuid,integer,public.movement_type,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid,integer,public.movement_type,text) TO authenticated;

-- Complete a sale atomically
CREATE OR REPLACE FUNCTION public.complete_sale(_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sale_id uuid; _item jsonb; _pay jsonb;
  _variant record; _qty int; _price numeric; _cost numeric; _line_disc numeric;
  _subtotal numeric := 0; _cost_total numeric := 0; _discount numeric := 0;
  _paid numeric := 0; _revenue numeric; _balance numeric; _pstatus public.payment_status;
  _idem text; _cust uuid; _existing uuid;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  _idem := _payload->>'idempotency_key';
  IF _idem IS NOT NULL THEN
    SELECT id INTO _existing FROM public.sales WHERE idempotency_key = _idem;
    IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  END IF;
  IF jsonb_array_length(COALESCE(_payload->'items','[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;

  _discount := GREATEST(COALESCE((_payload->>'discount')::numeric, 0), 0);
  _cust := NULLIF(_payload->>'customer_id','')::uuid;

  INSERT INTO public.sales(customer_id, customer_name, discount, notes, due_date, idempotency_key, staff_id, status)
  VALUES (_cust, NULLIF(_payload->>'customer_name',''), _discount, NULLIF(_payload->>'notes',''),
          NULLIF(_payload->>'due_date','')::date, _idem, auth.uid(), 'completed')
  RETURNING id INTO _sale_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_payload->'items') LOOP
    SELECT v.id, v.product_id, v.color, v.size,
           COALESCE(v.selling_price, p.selling_price) AS sell,
           COALESCE(v.buy_price, p.buy_price) AS buy, p.name AS pname
      INTO _variant
      FROM public.product_variants v JOIN public.products p ON p.id = v.product_id
      WHERE v.id = (_item->>'variant_id')::uuid;
    IF _variant.id IS NULL THEN RAISE EXCEPTION 'Product variant not found'; END IF;

    _qty := (_item->>'quantity')::int;
    IF _qty IS NULL OR _qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    -- price may be overridden per line but never below zero; cost always from DB
    _price := COALESCE(NULLIF(_item->>'unit_price','')::numeric, _variant.sell);
    IF _price < 0 THEN RAISE EXCEPTION 'Invalid price'; END IF;
    _line_disc := GREATEST(COALESCE(NULLIF(_item->>'discount','')::numeric, 0), 0);
    _cost := _variant.buy;

    INSERT INTO public.sale_items(sale_id, variant_id, product_id, product_name, variant_label, quantity, unit_price, unit_cost, discount, line_revenue, line_cost, line_profit)
    VALUES (_sale_id, _variant.id, _variant.product_id, _variant.pname,
            NULLIF(trim(both ' / ' FROM concat_ws(' / ', _variant.color, _variant.size)), ''),
            _qty, _price, _cost, _line_disc,
            (_price * _qty) - _line_disc, _cost * _qty, ((_price * _qty) - _line_disc) - (_cost * _qty));

    _subtotal := _subtotal + (_price * _qty) - _line_disc;
    _cost_total := _cost_total + (_cost * _qty);
    PERFORM public.apply_stock_change(_variant.id, -_qty, 'sale', 'POS sale', _sale_id, NULL, NULL, NULL, _cost);
  END LOOP;

  _revenue := GREATEST(_subtotal - _discount, 0);

  FOR _pay IN SELECT * FROM jsonb_array_elements(COALESCE(_payload->'payments','[]'::jsonb)) LOOP
    IF COALESCE((_pay->>'amount')::numeric,0) > 0 THEN
      INSERT INTO public.payments(sale_id, customer_id, amount, method, reference, received_by)
      VALUES (_sale_id, _cust, (_pay->>'amount')::numeric, COALESCE(_pay->>'method','Cash'), NULLIF(_pay->>'reference',''), auth.uid());
      _paid := _paid + (_pay->>'amount')::numeric;
    END IF;
  END LOOP;

  IF _paid > _revenue THEN _paid := _revenue; END IF;
  _balance := _revenue - _paid;
  _pstatus := CASE WHEN _balance <= 0 THEN 'paid' WHEN _paid > 0 THEN 'partial'
                   WHEN COALESCE(_payload->>'is_credit','false')::boolean THEN 'credit' ELSE 'unpaid' END;

  UPDATE public.sales SET subtotal = _subtotal, revenue = _revenue, cost = _cost_total,
    profit = _revenue - _cost_total, amount_paid = _paid, balance = _balance, payment_status = _pstatus
  WHERE id = _sale_id;

  PERFORM public.log_audit('sale_completed','sale',_sale_id, NULL, jsonb_build_object('revenue',_revenue,'profit',_revenue-_cost_total), NULL);
  RETURN _sale_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.complete_sale(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.complete_sale(jsonb) TO authenticated;

-- Cancel a sale (restores stock)
CREATE OR REPLACE FUNCTION public.cancel_sale(_sale_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; st public.sale_status;
BEGIN
  IF NOT public.has_min_role('manager') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT status INTO st FROM public.sales WHERE id = _sale_id FOR UPDATE;
  IF st IS NULL THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF st = 'cancelled' THEN RAISE EXCEPTION 'Sale already cancelled'; END IF;
  FOR r IN SELECT variant_id, quantity - returned_qty AS qty FROM public.sale_items WHERE sale_id = _sale_id LOOP
    IF r.qty > 0 THEN PERFORM public.apply_stock_change(r.variant_id, r.qty, 'return', COALESCE(_reason,'Sale cancelled'), _sale_id); END IF;
  END LOOP;
  UPDATE public.sales SET status='cancelled', revenue=0, profit=0, cost=0, balance=0, payment_status='unpaid' WHERE id=_sale_id;
  PERFORM public.log_audit('sale_cancelled','sale',_sale_id,NULL,NULL,_reason);
END; $$;
REVOKE EXECUTE ON FUNCTION public.cancel_sale(uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_sale(uuid,text) TO authenticated;

-- Confirm purchase -> increases stock once
CREATE OR REPLACE FUNCTION public.confirm_purchase(_purchase_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; st public.purchase_status; total numeric := 0;
BEGIN
  IF NOT public.has_min_role('admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT status INTO st FROM public.purchases WHERE id=_purchase_id FOR UPDATE;
  IF st IS NULL THEN RAISE EXCEPTION 'Purchase not found'; END IF;
  IF st <> 'draft' THEN RAISE EXCEPTION 'Purchase already %', st; END IF;
  FOR r IN SELECT variant_id, quantity, buy_price FROM public.purchase_items WHERE purchase_id=_purchase_id LOOP
    PERFORM public.apply_stock_change(r.variant_id, r.quantity, 'receive', 'Purchase received', NULL, _purchase_id, NULL, NULL, r.buy_price);
    total := total + (r.quantity * r.buy_price);
  END LOOP;
  UPDATE public.purchases SET status='confirmed', confirmed_at=now(), total_cost=total WHERE id=_purchase_id;
  PERFORM public.log_audit('purchase_confirmed','purchase',_purchase_id,NULL,jsonb_build_object('total',total),NULL);
END; $$;
REVOKE EXECUTE ON FUNCTION public.confirm_purchase(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirm_purchase(uuid) TO authenticated;

-- Process a return
CREATE OR REPLACE FUNCTION public.process_return(_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _ret uuid; _item jsonb; si record; _qty int; _refund numeric := 0; _costrev numeric := 0; _sale record;
BEGIN
  IF NOT public.has_min_role('manager') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO _sale FROM public.sales WHERE id=(_payload->>'sale_id')::uuid FOR UPDATE;
  IF _sale.id IS NULL THEN RAISE EXCEPTION 'Sale not found'; END IF;
  INSERT INTO public.returns(sale_id, customer_id, reason, refund_method, created_by)
  VALUES (_sale.id, _sale.customer_id, NULLIF(_payload->>'reason',''), COALESCE(_payload->>'refund_method','Cash'), auth.uid())
  RETURNING id INTO _ret;

  FOR _item IN SELECT * FROM jsonb_array_elements(_payload->'items') LOOP
    SELECT * INTO si FROM public.sale_items WHERE id=(_item->>'sale_item_id')::uuid AND sale_id=_sale.id FOR UPDATE;
    IF si.id IS NULL THEN RAISE EXCEPTION 'Sale item not found'; END IF;
    _qty := (_item->>'quantity')::int;
    IF _qty <= 0 THEN RAISE EXCEPTION 'Invalid return quantity'; END IF;
    IF si.returned_qty + _qty > si.quantity THEN RAISE EXCEPTION 'Return quantity exceeds sold quantity'; END IF;
    UPDATE public.sale_items SET returned_qty = returned_qty + _qty WHERE id = si.id;
    INSERT INTO public.return_items(return_id, sale_item_id, variant_id, quantity, unit_price, unit_cost)
    VALUES (_ret, si.id, si.variant_id, _qty, si.unit_price, si.unit_cost);
    PERFORM public.apply_stock_change(si.variant_id, _qty, 'return', 'Customer return', _sale.id, NULL, _ret, NULL, si.unit_cost);
    _refund := _refund + (si.unit_price * _qty);
    _costrev := _costrev + (si.unit_cost * _qty);
  END LOOP;

  UPDATE public.returns SET refund_amount=_refund, cost_reversed=_costrev WHERE id=_ret;
  UPDATE public.sales SET
    revenue = GREATEST(revenue - _refund, 0),
    cost = GREATEST(cost - _costrev, 0),
    profit = GREATEST(revenue - _refund, 0) - GREATEST(cost - _costrev, 0),
    balance = GREATEST(GREATEST(revenue - _refund,0) - amount_paid, 0),
    payment_status = CASE WHEN amount_paid >= GREATEST(revenue - _refund,0) THEN 'paid' WHEN amount_paid > 0 THEN 'partial' ELSE payment_status END
  WHERE id=_sale.id;
  PERFORM public.log_audit('return_processed','return',_ret,NULL,jsonb_build_object('refund',_refund),NULLIF(_payload->>'reason',''));
  RETURN _ret;
END; $$;
REVOKE EXECUTE ON FUNCTION public.process_return(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.process_return(jsonb) TO authenticated;

-- Record a payment against a sale
CREATE OR REPLACE FUNCTION public.record_payment(_sale_id uuid, _amount numeric, _method text, _reference text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; pid uuid; newpaid numeric; bal numeric;
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  SELECT * INTO s FROM public.sales WHERE id=_sale_id FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF s.status = 'cancelled' THEN RAISE EXCEPTION 'Sale is cancelled'; END IF;
  IF _amount > s.balance THEN RAISE EXCEPTION 'Amount exceeds outstanding balance'; END IF;
  INSERT INTO public.payments(sale_id, customer_id, amount, method, reference, received_by)
  VALUES (_sale_id, s.customer_id, _amount, COALESCE(_method,'Cash'), NULLIF(_reference,'')) RETURNING id INTO pid;
  UPDATE public.payments SET received_by = auth.uid() WHERE id = pid;
  INSERT INTO public.payment_allocations(payment_id, sale_id, amount) VALUES (pid, _sale_id, _amount);
  newpaid := s.amount_paid + _amount; bal := s.revenue - newpaid;
  UPDATE public.sales SET amount_paid=newpaid, balance=bal,
    payment_status = CASE WHEN bal <= 0 THEN 'paid' WHEN newpaid > 0 THEN 'partial' ELSE payment_status END
  WHERE id=_sale_id;
  PERFORM public.log_audit('payment_recorded','sale',_sale_id,NULL,jsonb_build_object('amount',_amount,'method',_method),NULL);
  RETURN pid;
END; $$;
REVOKE EXECUTE ON FUNCTION public.record_payment(uuid,numeric,text,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_payment(uuid,numeric,text,text) TO authenticated;

-- Approve stock count -> apply differences
CREATE OR REPLACE FUNCTION public.approve_stock_count(_count_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; st public.count_status;
BEGIN
  IF NOT public.has_min_role('manager') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT status INTO st FROM public.stock_counts WHERE id=_count_id FOR UPDATE;
  IF st IS NULL THEN RAISE EXCEPTION 'Stock count not found'; END IF;
  IF st = 'approved' THEN RAISE EXCEPTION 'Already approved'; END IF;
  FOR r IN SELECT variant_id, difference FROM public.stock_count_items WHERE stock_count_id=_count_id AND physical_qty IS NOT NULL AND difference <> 0 LOOP
    PERFORM public.apply_stock_change(r.variant_id, r.difference, 'count', 'Stock count adjustment', NULL, NULL, NULL, _count_id);
  END LOOP;
  UPDATE public.stock_counts SET status='approved', approved_by=auth.uid(), approved_at=now() WHERE id=_count_id;
  PERFORM public.log_audit('stock_count_approved','stock_count',_count_id,NULL,NULL,NULL);
END; $$;
REVOKE EXECUTE ON FUNCTION public.approve_stock_count(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.approve_stock_count(uuid) TO authenticated;

-- Assign / change a user role (super admin only)
CREATE OR REPLACE FUNCTION public.set_user_role(_user_id uuid, _role public.app_role)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_min_role('super_admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  DELETE FROM public.user_roles WHERE user_id=_user_id;
  INSERT INTO public.user_roles(user_id, role) VALUES (_user_id, _role);
  PERFORM public.log_audit('role_changed','user',_user_id,NULL,jsonb_build_object('role',_role),NULL);
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, public.app_role) TO authenticated;
