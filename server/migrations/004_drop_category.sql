-- Category is no longer collected on submission. Drop the column outright;
-- historical category data is intentionally discarded.
ALTER TABLE submissions
  DROP COLUMN IF EXISTS category;
