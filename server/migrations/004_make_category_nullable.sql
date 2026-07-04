-- Category is hidden from the UI for now but retained in the schema for
-- future use. Drop NOT NULL so submissions can be created without a category
-- while it's not being collected. The existing CHECK constraint still permits
-- NULL and continues to validate any non-null values written later.
ALTER TABLE submissions
  ALTER COLUMN category DROP NOT NULL;
