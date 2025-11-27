-- Add approval fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN is_approved BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN approved_by UUID REFERENCES auth.users(id);

-- Add index for faster queries on approval status
CREATE INDEX idx_profiles_is_approved ON public.profiles(is_approved);

-- Update RLS policy to allow admins to update approval status
CREATE POLICY "Admins can update user approval status"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create a function to approve users
CREATE OR REPLACE FUNCTION public.approve_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can approve users';
  END IF;

  -- Update the user profile
  UPDATE public.profiles
  SET 
    is_approved = true,
    approved_at = now(),
    approved_by = auth.uid()
  WHERE id = target_user_id;
END;
$$;

-- Approve the existing admin user (amudarling@gmail.com)
UPDATE public.profiles
SET 
  is_approved = true,
  approved_at = now()
WHERE id = '60a9b007-39ca-47e0-b933-45d6e3effc5a';