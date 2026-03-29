const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://postgres.wgcglpunevuvdujjofrn:pyFc6kcWWLGZnFwe@aws-1-ap-southeast-1.pooler.supabase.co:6543/postgres?sslmode=require&pgbouncer=true"
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to Supabase Pooler.");

    console.log("Adding columns to student_profiles...");
    
    // Add columns one by one
    await client.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS "studentId" TEXT;');
    await client.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS "academicProgram" TEXT;');
    
    console.log("Ensuring uniqueness index for studentId...");
    await client.query('CREATE UNIQUE INDEX IF NOT EXISTS student_profiles_studentId_key ON student_profiles("studentId");');

    console.log("SUCCESS: Database schema reconciled via Raw SQL.");
  } catch (err) {
    console.error("MIGRATION FAILED:", err);
  } finally {
    await client.end();
  }
}

run();
