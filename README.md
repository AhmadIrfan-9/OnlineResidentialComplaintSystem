# Online Residential Complaint System

## Quick Start (API + Database)
1. Install dependencies:
```bash
npm install
```
2. Create your env file:
```bash
cp .env.example .env
```
3. Fill in `DATABASE_URL`, `DIRECT_URL`, and auth keys in `.env`.
4. Generate Prisma client:
```bash
npx prisma generate
```
5. Push schema and seed data:
```bash
npx prisma db push
npm run db:seed
```
6. Start the app:
```bash
npm run dev
```

Open `http://localhost:3000`.

## Standard DB Connection Format
Use this format in `.env`:
```env
DATABASE_URL="postgresql://postgres:<password>@<host>:5432/postgres?sslmode=require"
DIRECT_URL="postgresql://postgres:<password>@<host>:5432/postgres?sslmode=require"
```

`sslmode=require` is the common baseline for local/dev with managed Postgres providers.

## Escalation Emails (Admin)
Overdue escalation emails are triggered from Admin Configuration using `/api/admin/escalations`.

Set these in `.env`:
```env
SMTP_HOST="smtp.your-provider.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="smtp-user"
SMTP_PASS="smtp-password"
SMTP_FROM="ORCS <no-reply@your-domain.com>"
ESCALATION_EMAIL_TO="dean@university.edu,my-manager@university.edu"
```

Notes:
- If `ESCALATION_EMAIL_TO` is empty, active management user emails are used.
- If SMTP env vars are missing, the system still queues in-app notifications but skips email sending.

# Collaborator: rzmegaresources
