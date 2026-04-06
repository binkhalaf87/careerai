CREATE TABLE public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  paymob_order_id text,
  paymob_intention_id text,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  points integer NOT NULL,
  package_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  paymob_transaction_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment orders" ON public.payment_orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment orders" ON public.payment_orders
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can update payment orders" ON public.payment_orders
  FOR UPDATE TO authenticated USING (true);

CREATE TRIGGER update_payment_orders_updated_at
  BEFORE UPDATE ON public.payment_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();