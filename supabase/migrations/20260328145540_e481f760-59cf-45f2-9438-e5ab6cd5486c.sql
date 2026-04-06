CREATE OR REPLACE FUNCTION public.deduct_points_atomic(
  p_user_id uuid,
  p_cost integer,
  p_type text,
  p_description text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_balance integer;
  v_new_balance integer;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_balance
  FROM public.point_transactions
  WHERE user_id = p_user_id;

  IF v_balance < p_cost THEN
    RETURN jsonb_build_object('success', false, 'balance', v_balance, 'error', 'Insufficient points');
  END IF;

  INSERT INTO public.point_transactions (user_id, amount, type, description)
  VALUES (p_user_id, -p_cost, p_type, p_description);

  v_new_balance := v_balance - p_cost;

  RETURN jsonb_build_object('success', true, 'balance', v_new_balance);
END;
$$;