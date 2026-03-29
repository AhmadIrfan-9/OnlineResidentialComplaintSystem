const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://postgres.wgcglpunevuvdujjofrn:pyFc6kcWWLGZnFwe@db.wgcglpunevuvdujjofrn.supabase.co:5432/postgres?sslmode=require"
});

async function run() {
  await client.connect();
  console.log("Connected to database.");

  // Check columns
  const res = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'student_profiles';
  `);
  console.log("Existing columns in student_profiles:", res.rows.map(r => r.column_name));

  // Add columns if missing
  try {
    console.log("Adding studentId column...");
    await client.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS "studentId" TEXT UNIQUE;');
    console.log("Adding academicProgram column...");
    await client.query('ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS "academicProgram" TEXT;');
    console.log("Adding academic program column success.");
  } catch (err) {
    console.error("Error modifying table:", err);
  }

  await client.end();
}

run().catch(console.error);
