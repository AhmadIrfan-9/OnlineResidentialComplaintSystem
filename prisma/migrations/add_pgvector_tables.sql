-- ============================================================
-- UNITEN Residential Portal — RAG Complaint Intelligence
-- Migration: Enable pgvector and create embedding tables
-- Run manually via Supabase SQL Editor or psql
-- ============================================================

-- Step 1: Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Add vector column to complaint_embeddings
-- Prisma creates the table structure; we add the pgvector column separately.
-- Safe to re-run (ALTER TABLE ... IF NOT EXISTS pattern below).

ALTER TABLE complaint_embeddings
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Step 3: Add vector column to policy_chunks
ALTER TABLE policy_chunks
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Step 4: Create HNSW indexes for fast approximate nearest-neighbour search
-- HNSW (Hierarchical Navigable Small World) is faster than IVFFlat for real-time queries
-- cosine distance (<=> operator) — best for normalised OpenAI embeddings

CREATE INDEX IF NOT EXISTS complaint_embeddings_hnsw_idx
  ON complaint_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS policy_chunks_hnsw_idx
  ON policy_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Step 5: Create a helper function for searching similar complaints
-- This is called by the retrieval service via pg raw query
CREATE OR REPLACE FUNCTION search_similar_complaints(
  query_embedding vector(1536),
  similarity_threshold float DEFAULT 0.72,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id text,
  complaint_id text,
  category text,
  priority text,
  hostel_block text,
  hostel_name text,
  description_snap text,
  resolution_snap text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ce.id::text,
    ce.complaint_id::text,
    ce.category::text,
    ce.priority::text,
    ce.hostel_block,
    ce.hostel_name,
    ce.description_snap,
    ce.resolution_snap,
    1 - (ce.embedding <=> query_embedding) AS similarity
  FROM complaint_embeddings ce
  WHERE ce.embedding IS NOT NULL
    AND 1 - (ce.embedding <=> query_embedding) > similarity_threshold
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Step 6: Create a helper function for searching policy chunks
CREATE OR REPLACE FUNCTION search_policy_chunks(
  query_embedding vector(1536),
  filter_category text DEFAULT NULL,
  similarity_threshold float DEFAULT 0.65,
  match_count int DEFAULT 3
)
RETURNS TABLE (
  id text,
  section_ref text,
  category text,
  title text,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.id::text,
    pc.section_ref,
    pc.category,
    pc.title,
    pc.content,
    1 - (pc.embedding <=> query_embedding) AS similarity
  FROM policy_chunks pc
  WHERE pc.embedding IS NOT NULL
    AND (filter_category IS NULL OR pc.category = filter_category OR pc.category IS NULL)
    AND 1 - (pc.embedding <=> query_embedding) > similarity_threshold
  ORDER BY pc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- Verify setup
-- ============================================================
-- SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
-- SELECT COUNT(*) FROM complaint_embeddings;
-- SELECT COUNT(*) FROM policy_chunks;
