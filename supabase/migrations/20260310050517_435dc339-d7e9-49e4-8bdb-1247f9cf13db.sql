
-- Add new subscription plan values
ALTER TYPE public.subscription_plan ADD VALUE IF NOT EXISTS 'basic';
ALTER TYPE public.subscription_plan ADD VALUE IF NOT EXISTS 'publish_only';

-- Create companies table for admin to manage target companies
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  industry text,
  email text,
  website text,
  location text,
  contact_person text,
  phone text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Only admins can manage companies
CREATE POLICY "Admins can view all companies" ON public.companies FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update companies" ON public.companies FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete companies" ON public.companies FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can view companies for publishing
CREATE POLICY "Users can view companies" ON public.companies FOR SELECT TO authenticated USING (true);
