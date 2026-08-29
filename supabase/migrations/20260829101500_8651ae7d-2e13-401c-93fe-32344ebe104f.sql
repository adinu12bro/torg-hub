
-- ============ ROLES & PROFILES ============
CREATE TYPE public.app_role AS ENUM ('staff','manager','admin','super_admin');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.role_rank(_role public.app_role)
RETURNS int LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _role WHEN 'staff' THEN 1 WHEN 'manager' THEN 2 WHEN 'admin' THEN 3 WHEN 'super_admin' THEN 4 END;
$$;

CREATE OR REPLACE FUNCTION public.max_role_rank(_user_id uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(MAX(public.role_rank(role)), 0) FROM public.user_roles WHERE user_id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.has_min_role(_role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.max_role_rank(auth.uid()) >= public.role_rank(_role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.max_role_rank(auth.uid()) >= 1;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_staff());
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_min_role('admin')) WITH CHECK (id = auth.uid() OR public.has_min_role('admin'));
CREATE POLICY profiles_insert_self ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff());
CREATE POLICY user_roles_write ON public.user_roles FOR ALL TO authenticated USING (public.has_min_role('super_admin')) WITH CHECK (public.has_min_role('super_admin'));

-- new user -> profile, first user becomes super_admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  SELECT count(*) INTO n FROM public.user_roles;
  IF n = 0 THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'super_admin');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'staff') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER t_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SETTINGS ============
CREATE TABLE public.settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.settings TO authenticated;
GRANT INSERT, UPDATE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_select ON public.settings FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY settings_write ON public.settings FOR ALL TO authenticated USING (public.has_min_role('admin')) WITH CHECK (public.has_min_role('admin'));

INSERT INTO public.settings(key, value) VALUES
  ('business', '{"name":"TORG Wholesale","currency":"INR","currency_symbol":"₹"}'::jsonb),
  ('inventory', '{"allow_negative_stock":false,"default_min_stock":5}'::jsonb),
  ('payment_methods', '["Cash","UPI","Card","Bank Transfer","Credit"]'::jsonb);

-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_parent ON public.categories(parent_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY categories_select ON public.categories FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY categories_write ON public.categories FOR ALL TO authenticated USING (public.has_min_role('admin')) WITH CHECK (public.has_min_role('admin'));
CREATE TRIGGER t_categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ SUPPLIERS ============
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_person text,
  phone text,
  whatsapp text,
  email text,
  address text,
  city text,
  state text,
  country text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY suppliers_select ON public.suppliers FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY suppliers_write ON public.suppliers FOR ALL TO authenticated USING (public.has_min_role('admin')) WITH CHECK (public.has_min_role('admin'));
CREATE TRIGGER t_suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ PRODUCTS & VARIANTS ============
CREATE TYPE public.product_status AS ENUM ('active','archived');

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text UNIQUE,
  description text,
  brand text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategory_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  images text[] NOT NULL DEFAULT '{}',
  buy_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (buy_price >= 0),
  selling_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  wholesale_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (wholesale_price >= 0),
  min_stock integer NOT NULL DEFAULT 5 CHECK (min_stock >= 0),
  high_volume_threshold integer NOT NULL DEFAULT 50 CHECK (high_volume_threshold >= 0),
  moq integer NOT NULL DEFAULT 1 CHECK (moq >= 1),
  status public.product_status NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_supplier ON public.products(supplier_id);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_name ON public.products(lower(name));

CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  color text,
  size text,
  sku text NOT NULL UNIQUE,
  barcode text UNIQUE,
  buy_price numeric(12,2) CHECK (buy_price >= 0),
  selling_price numeric(12,2) CHECK (selling_price >= 0),
  wholesale_price numeric(12,2) CHECK (wholesale_price >= 0),
  stock integer NOT NULL DEFAULT 0,
  min_stock integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, color, size)
);
CREATE INDEX idx_variants_product ON public.product_variants(product_id);
CREATE INDEX idx_variants_barcode ON public.product_variants(barcode);

-- barcodes table supports multiple codes per variant; code_type allows future 'qr'
CREATE TYPE public.code_type AS ENUM ('barcode','qr');
CREATE TABLE public.barcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  code_type public.code_type NOT NULL DEFAULT 'barcode',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_barcodes_variant ON public.barcodes(variant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barcodes TO authenticated;
GRANT ALL ON public.barcodes TO service_role;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barcodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_select ON public.products FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY products_write ON public.products FOR ALL TO authenticated USING (public.has_min_role('admin')) WITH CHECK (public.has_min_role('admin'));
CREATE POLICY variants_select ON public.product_variants FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY variants_write ON public.product_variants FOR ALL TO authenticated USING (public.has_min_role('admin')) WITH CHECK (public.has_min_role('admin'));
CREATE POLICY barcodes_select ON public.barcodes FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY barcodes_write ON public.barcodes FOR ALL TO authenticated USING (public.has_min_role('admin')) WITH CHECK (public.has_min_role('admin'));

CREATE TRIGGER t_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_variants_updated BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ CUSTOMERS ============
CREATE TYPE public.customer_status AS ENUM ('active','inactive','blocked');
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  shop_name text,
  phone text,
  whatsapp text,
  email text,
  instagram text,
  address text,
  city text,
  state text,
  country text,
  notes text,
  credit_limit numeric(12,2) NOT NULL DEFAULT 0,
  status public.customer_status NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_name ON public.customers(lower(name));
CREATE INDEX idx_customers_phone ON public.customers(phone);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY customers_select ON public.customers FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY customers_insert ON public.customers FOR INSERT TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY customers_update ON public.customers FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY customers_delete ON public.customers FOR DELETE TO authenticated USING (public.has_min_role('admin'));
CREATE TRIGGER t_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
