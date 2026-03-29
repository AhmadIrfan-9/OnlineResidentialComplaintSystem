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
    WHERE table_name = 'student_profiles'
    ORDER BY column_name;
  `);
  console.log("REAL_COLUMNS_START");
  res.rows.forEach(r => console.log(r.column_name));
  console.log("REAL_COLUMNS_END");

  await client.end();
}

run().catch(console.error);
