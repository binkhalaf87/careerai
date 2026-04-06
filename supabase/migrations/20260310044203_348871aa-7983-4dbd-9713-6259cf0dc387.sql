
-- Gmail tokens table for storing OAuth tokens securely
CREATE TABLE public.gmail_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  gmail_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only view their own tokens
CREATE POLICY "Users can view own gmail tokens"
  ON public.gmail_tokens FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own tokens
CREATE POLICY "Users can insert own gmail tokens"
  ON public.gmail_tokens FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own tokens
CREATE POLICY "Users can update own gmail tokens"
  ON public.gmail_tokens FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own tokens (disconnect)
CREATE POLICY "Users can delete own gmail tokens"
  ON public.gmail_tokens FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Add update trigger for updated_at
CREATE TRIGGER update_gmail_tokens_updated_at
  BEFORE UPDATE ON public.gmail_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Also allow updating marketing_emails (needed for status updates)
CREATE POLICY "Users can update own marketing emails"
  ON public.marketing_emails FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
