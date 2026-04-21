-- Rename old type
ALTER TYPE "Status" RENAME TO "Status_old";

-- Create new type with exactly the 4 allowed values
CREATE TYPE "Status" AS ENUM ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- Temporarily drop the default so we don't hold on to old type
ALTER TABLE "complaints" ALTER COLUMN "status" DROP DEFAULT;

-- Update the column to use the new type, mapping values during the cast!
ALTER TABLE "complaints" ALTER COLUMN "status" TYPE "Status" USING (
  CASE "status"::text
    WHEN 'SUBMITTED' THEN 'PENDING'
    WHEN 'ACKNOWLEDGED' THEN 'PENDING'
    WHEN 'UNDER_REVIEW' THEN 'IN_PROGRESS'
    ELSE "status"::text
  END
)::"Status";

-- Drop the old type
DROP TYPE "Status_old";

-- Set the new default
ALTER TABLE "complaints" ALTER COLUMN "status" SET DEFAULT 'PENDING';
