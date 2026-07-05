-- Add an optional contact phone number, mirroring contact_email: citizens may
-- supply it so staff can follow up by phone. Nullable and unvalidated at the
-- DB level, same as contact_email.
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;
