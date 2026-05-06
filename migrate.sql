ALTER TABLE complaints ALTER COLUMN category TYPE text USING category::text;
ALTER TABLE complaint_embeddings ALTER COLUMN category TYPE text USING category::text;
DROP TYPE IF EXISTS "ComplaintCategory";
