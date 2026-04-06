DROP POLICY "Service role can update payment orders" ON public.payment_orders;

CREATE POLICY "Users can view own payment orders update" ON public.payment_orders
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);