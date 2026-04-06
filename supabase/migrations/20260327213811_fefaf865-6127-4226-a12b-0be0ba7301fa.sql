
-- Add cv_upload_count to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cv_upload_count integer NOT NULL DEFAULT 0;

-- Create trigger function to give new users 30 points on signup
CREATE OR REPLACE FUNCTION public.grant_initial_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.point_transactions (user_id, amount, type, description)
  VALUES (NEW.id, 30, 'signup_bonus', 'Welcome bonus - 30 points');
  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users on insert
DROP TRIGGER IF EXISTS on_auth_user_created_grant_points ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_points
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_initial_points();
