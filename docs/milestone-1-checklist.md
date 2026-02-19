# Milestone 1 Checklist (ORCS)

## 1. Environment - Supabase & Prisma Integration
- Status: ✅ Completed
- Evidence:
  - Prisma client uses Supabase/Postgres adapter in `src/lib/prisma.ts`.
  - DB exports centralized in `src/lib/db.ts`.
  - Environment wiring via `DATABASE_URL` and `SKIP_DB` in `.env`.

## 2. Database - Migration of ORCS Schema
- Status: ✅ Completed
- Evidence:
  - Prisma schema defined in `prisma/schema.prisma`.
  - Migration SQL artifact created in:
    - `prisma/migrations/20260219225804_milestone1_orcs_schema/migration.sql`

## 3. Authentication - Login / Role-based Redirect
- Status: ✅ Completed
- Evidence:
  - Credentials authentication in `src/lib/auth.ts`.
  - Role-based redirects:
    - `src/app/page.tsx`
    - `src/app/dashboard/page.tsx`
    - `src/app/(auth)/login/page.tsx`
  - Role guards in `middleware.ts`.
  - Role normalization helpers in `src/lib/roles.ts`.

## 4. Complaint - Basic Create Functionality
- Status: ✅ Completed
- Evidence:
  - Complaint create API in `src/app/api/complaints/route.ts` (`POST`).
  - Student submit UI wired to API in `src/components/shared/StudentComplaintForm.tsx`.
  - Student room context passed from `src/app/student/new/page.tsx`.
  - Server action implementation available in `src/actions/complaints.ts`.

## 5. UI/UX - Dashboard Shell (Navigation)
- Status: ✅ Completed
- Evidence:
  - Shared sidebar/navigation component in `src/components/shared/DashboardSidebar.tsx`.
  - Student dashboard shell in `src/app/dashboard/student/page.tsx`:
    - Top navigation
    - Greeting
    - Summary cards
    - Quick action
    - Recent complaints list
    - Mobile-friendly layout with horizontal nav scrolling

---

## Notes for Demo/Report
- Current development scope is a single hostel option (`Cendikiawan`) for registration dropdown.
- Role model aligned to Prisma enum:
  - `STUDENT`
  - `MANAGEMENT`
  - `IT_STAFF_ADMIN`
