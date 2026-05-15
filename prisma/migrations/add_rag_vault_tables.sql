-- ============================================================
-- ORCS — RAG Document Vault
-- Run manually via Supabase SQL Editor or psql AFTER running
-- prisma db push / prisma migrate to create the base tables.
-- ============================================================

-- 1. Ensure pgvector is enabled (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding column to rag_document_chunks
ALTER TABLE rag_document_chunks
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS rag_document_chunks_hnsw_idx
  ON rag_document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. Search function — returns top-k chunks across all READY documents
CREATE OR REPLACE FUNCTION search_rag_chunks(
  query_embedding   vector(1536),
  similarity_threshold float  DEFAULT 0.60,
  match_count       int       DEFAULT 6
)
RETURNS TABLE (
  id           text,
  document_id  text,
  chunk_index  int,
  content      text,
  similarity   float,
  doc_title    text,
  doc_filename text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id::text,
    c.document_id::text,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity,
    d.title        AS doc_title,
    d.file_name    AS doc_filename
  FROM rag_document_chunks c
  JOIN rag_documents d ON d.id = c.document_id
  WHERE c.embedding IS NOT NULL
    AND d.status = 'READY'
    AND 1 - (c.embedding <=> query_embedding) > similarity_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- Verify
-- SELECT COUNT(*) FROM rag_documents;
-- SELECT COUNT(*) FROM rag_document_chunks;
-- ============================================================
