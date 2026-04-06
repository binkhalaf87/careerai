
-- Point transactions table for tracking all point activity
CREATE TABLE public.point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL, -- positive = credit, negative = debit
  type text NOT NULL DEFAULT 'admin_credit', -- admin_credit, admin_debit, admin_set, purchase, analysis, enhancement, marketing_send
  description text,
  admin_id uuid, -- who performed the action (for admin operations)
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;

-- Users can view own transactions
CREATE POLICY "Users can view own point transactions"
ON public.point_transactions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all transactions
CREATE POLICY "Admins can view all point transactions"
ON public.point_transactions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert transactions
CREATE POLICY "Admins can insert point transactions"
ON public.point_transactions
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Users can insert own debit transactions (for usage deductions)
CREATE POLICY "Users can insert own debit transactions"
ON public.point_transactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND amount < 0);
