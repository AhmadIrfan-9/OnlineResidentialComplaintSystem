# RBAC Interface Test Cases (ORCS)

## Scope
Validate that each role sees only its allowed interface and is blocked/redirected from unauthorized pages and admin APIs.

## Roles Under Test
- `STUDENT`
- `MANAGEMENT`
- `IT_STAFF_ADMIN`
- Unauthenticated user

## Preconditions
1. App is running (`npm run dev`).
2. Middleware is active (`middleware.ts`).
3. Seed/create at least one account per role.
4. Test URLs are available:
- Student area: `/dashboard/student`, `/student/new`, `/complaints`, `/complaints/new`
- Management area: `/dashboard/warden`, `/warden/dashboard`, `/warden/queue`
- Admin area: `/admin`, `/admin/configuration`, `/admin/users`, `/admin/audit-logs`

## Test Data
- Student user: `student1@uniten.edu.my` (role `STUDENT`)
- Management user: `manager1@uniten.edu.my` (role `MANAGEMENT`)
- Admin user: `admin1@uniten.edu.my` (role `IT_STAFF_ADMIN`)

## A. Authentication and Default Redirect

| ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| RBAC-001 | Unauthenticated access to protected route | Open `/dashboard` without login | Redirect to `/login` |
| RBAC-002 | Student post-login redirect | Login as `STUDENT`, open `/dashboard` | Redirect to `/dashboard/student` |
| RBAC-003 | Management post-login redirect | Login as `MANAGEMENT`, open `/dashboard` | Redirect to `/dashboard/warden` |
| RBAC-004 | Admin post-login redirect | Login as `IT_STAFF_ADMIN`, open `/dashboard` | Redirect to `/admin` |
| RBAC-005 | Authenticated user opens `/login` | Login, then visit `/login` | Redirect to role home (`/dashboard/student` or `/dashboard/warden` or `/admin`) |

## B. Page-Level Authorization Matrix

### B1. Student (`STUDENT`)

| ID | Route | Expected |
|---|---|---|
| RBAC-101 | `/dashboard/student` | Allowed |
| RBAC-102 | `/student/new` | Allowed |
| RBAC-103 | `/complaints` | Allowed |
| RBAC-104 | `/dashboard/warden` | Redirect to `/dashboard/student` |
| RBAC-105 | `/warden/queue` | Redirect to `/dashboard/student` |
| RBAC-106 | `/admin` | Redirect to `/dashboard` |
| RBAC-107 | `/admin/users` | Redirect to `/dashboard` |

### B2. Management (`MANAGEMENT`)

| ID | Route | Expected |
|---|---|---|
| RBAC-201 | `/dashboard/warden` | Allowed |
| RBAC-202 | `/warden/queue` | Allowed |
| RBAC-203 | `/warden/complaints/[id]` | Allowed |
| RBAC-204 | `/dashboard/student` | Redirect to `/dashboard/warden` |
| RBAC-205 | `/student/new` | Redirect to `/dashboard/warden` |
| RBAC-206 | `/admin` | Redirect to `/dashboard` |
| RBAC-207 | `/admin/configuration` | Redirect to `/dashboard` |

### B3. Admin (`IT_STAFF_ADMIN`)

| ID | Route | Expected |
|---|---|---|
| RBAC-301 | `/admin` | Allowed |
| RBAC-302 | `/admin/configuration` | Allowed |
| RBAC-303 | `/admin/users` | Allowed |
| RBAC-304 | `/admin/audit-logs` | Allowed |
| RBAC-305 | `/dashboard/warden` | Allowed (admin is treated as management) |
| RBAC-306 | `/warden/queue` | Allowed |
| RBAC-307 | `/dashboard/student` | Redirect to `/dashboard/warden` |
| RBAC-308 | `/student/new` | Redirect to `/dashboard/warden` |

## C. API-Level Authorization (Admin APIs)

| ID | Endpoint | Actor | Expected |
|---|---|---|---|
| RBAC-401 | `GET /api/admin/users` | Unauthenticated | `401 Unauthorized` |
| RBAC-402 | `GET /api/admin/users` | `STUDENT` | `401 Unauthorized` |
| RBAC-403 | `GET /api/admin/users` | `MANAGEMENT` | `401 Unauthorized` |
| RBAC-404 | `GET /api/admin/users` | `IT_STAFF_ADMIN` | `200 OK` |
| RBAC-405 | `GET /api/admin/audit-logs` | `IT_STAFF_ADMIN` | `200 OK` |
| RBAC-406 | `POST /api/admin/categories` | `IT_STAFF_ADMIN` | `201` or `200` with created data |

## D. Interface Visibility Checks per Role

| ID | Role | Check |
|---|---|---|
| RBAC-501 | STUDENT | Student dashboard widgets and submit form visible |
| RBAC-502 | STUDENT | No admin navigation items visible |
| RBAC-503 | MANAGEMENT | Queue/detail/resolution views visible |
| RBAC-504 | MANAGEMENT | No admin config/user/audit links visible |
| RBAC-505 | ADMIN | Admin nav (`Configuration`, `User Management`, `Audit Logs`, `Reports`) visible |
| RBAC-506 | ADMIN | Admin can open user table and audit table without auth errors |

## E. Negative and Edge Cases

| ID | Scenario | Steps | Expected Result |
|---|---|---|---|
| RBAC-601 | Tampered URL deep-link | As `STUDENT`, paste `/admin/audit-logs` | Redirect to `/dashboard` |
| RBAC-602 | Session expiry | Login, expire/remove token, refresh protected page | Redirect to `/login` |
| RBAC-603 | Inactive account | Set `isActive=false`, attempt login | Login denied with account inactive error |
| RBAC-604 | Role change during active session | Change role in DB, refresh `/dashboard` | Redirect changes to new role home |

## Pass Criteria
- All expected redirects and HTTP status codes match.
- No restricted page renders protected content before redirect.
- No unauthorized admin API call returns `200`.

## Optional Automation (Playwright)
- Convert Section A/B/C into e2e specs:
1. `auth-redirect.spec.ts`
2. `rbac-student.spec.ts`
3. `rbac-management.spec.ts`
4. `rbac-admin.spec.ts`
5. `rbac-admin-api.spec.ts`
