# Student's Overall Summary of the Project: Online Residential Complaint System (ORCS)

## 1. Overall Summary Sentence & Explanation
**Summary:** The Online Residential Complaint System (UNITEN ORCS) is a decoupled, type-safe, production-ready full-stack web application designed for the Universiti Tenaga Nasional (UNITEN) College of Computing and Informatics (CCI) to manage the complete lifecycle of hostel complaints from submission through resolution. 

**Explanation:** The system replaces static processes with an intelligent, responsive portal featuring role-based dashboards for Students, Wardens, and IT Administrators. It optimizes complaint resolution through automated ITIL-based severity and SLA mapping, utilizes real-time notifications via WebSockets, and leverages artificial intelligence (GPT-4o) with a Retrieval-Augmented Generation (RAG) document vault to triage complaints and assist management with policy-grounded decision making.

---

## 2. System Architecture & Technical Design

The modular system design isolates layers of responsibility to ensure transactional data integrity, low-latency UI responsiveness, and secure AI processing.

```
[Client Layer: React / Tailwind CSS / Next.js Client Engine]
                         │
                         ▼ (Secure JSON Web Tokens / HTTPS)
[Application Layer: Next.js Serverless API Route Handlers]
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
[Database Layer]  [Cache Layer]   [AI Inference Layer]
Relational DB      Redis Cache     Multimodal ITIL Triage
(Prisma / PG)     (Notification)    (GPT-4o RAG Vault)
```

*   **Client Layer:** Operates within student or staff browsers using React, Tailwind CSS, and the Next.js Client Engine. It communicates with the backend via HTTPS REST API requests and Socket.io WebSockets.
*   **Application Layer:** Next.js Serverless API Route Handlers process incoming client requests and coordinate database operations, real-time caching, and AI logic.
*   **Database Layer:** Managed by Prisma ORM connecting to a hosted PostgreSQL relational database on Supabase.
*   **Cache Layer:** Uses Redis to manage real-time in-app notification queues.
*   **AI Inference Layer:** Employs multimodal ITIL triage and a GPT-4o policy-grounded RAG vault.

---

## 3. Technology Stack Specifications

*   **Frontend & Rendering:** Next.js 16 (React 19 Client-Server Architecture).
*   **Styling:** Tailwind CSS (compiled via utility-first PostCSS pipelines).
*   **State & Authentication:** NextAuth.js implementing secure JWT (JSON Web Tokens) transport layers (configured to throw error at startup via IIFE if `AUTH_SECRET` is missing).
*   **Cryptography:** Client passwords hashed using bcryptjs.
*   **Database ORM:** Prisma ORM.
*   **Database Host:** PostgreSQL on Supabase.
*   **Real-time Engine:** Socket.io utilizing Node server processes with Redis publisher/subscriber.
*   **AI Models:** OpenAI GPT-4o (multimodal inputs) and `text-embedding-3-small` (generating 1536-dimensional embeddings for pgvector).
*   **Text Extraction:** `pdf-parse` (for PDF files), `mammoth` (for DOCX files), and GPT-4o Vision OCR (for image extraction).

---

## 4. Module & Interface Breakdown

### 4.1. Dual-Identifier Authentication Interface
*   **Visual Design:** Symmetrical single-card layout with premium dark blue headers matching the UNITEN corporate design. High-contrast white typography over dark containers ensures universal accessibility compliance, with focus rings using HSL-tailored glow rings that shift state on interaction.
*   **Operation:** Accepts either institutional emails or unique Student ID alphanumeric patterns (e.g., SW01084131) via a single input field. It runs a multi-clause database check:
    ```typescript
    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: incomingIdentifier.toLowerCase().trim() },
          { studentId: incomingIdentifier.toUpperCase().trim() }
        ]
      }
    });
    ```
*   **Security:** Checks `isActive` flag, updates `lastLoginAt`, logs audit trails, locks account for the remainder of a 15-minute window after 5 failed login attempts (brute-force protection), and uses `randomBytes` (10-character base64url) for default passwords, requiring user change on onboarding.

### 4.2. Multi-Modal Student Complaint Form
*   **Visual Design:** Normalized 3-tier side-by-side dropdown selectors for Block, Floor, and Unit. The evidence dropzone features a dashed accent border and shows an inline thumbnail grid of selected images with absolute-positioned deletion indicators.
*   **Operation:** Restricts inputs to database-verified room inventories. Prevents page layout shifting by toggling empty states and thumbnail previews. Combines JSON payloads and binary evidence files into a structured multipart payload.

### 4.3. Warden Analytics & Triage Command Center
*   **Visual Design:** 50/50 horizontal split grid optimizing visual density. The left side tracks active tickets, and the right tracks resolved closures. A `CategoryDistributionChart` pie graphic displays contrasting slices representing category weights.
*   **Operation:** Streamlines views by tracking notifications via the global navigation bell system instead of redundant alert boxes. WebSocket tunnels stream updates to automatically recalculate resolutions and update status graphs in real time.

### 4.4. Administrative User Management Console
*   **Visual Design:** Tabular data view with an overlay modal incorporating the identical 3-tier room dropdown component structure for UI uniformity.
*   **Operation:** Allows administrators to bulk-provision users, assign roles (STUDENT, MANAGEMENT, IT_STAFF_ADMIN), assign wardens to hostels, and validate that hostels do not have duplicate active managers.

---

## 5. Algorithmic and Decision Logic (ITIL Triage)

ORCS enforces objective prioritization using an automated server-side implementation of the standard **Information Technology Infrastructure Library (ITIL) Framework**. Priority is calculated deterministically:

$$\text{Priority} = \text{Impact} \times \text{Urgency}$$

### 5.1. Evaluation Metric Scoring

| Metric | Score 1 (Low) | Score 2 (Medium) | Score 3 (High) |
| :--- | :--- | :--- | :--- |
| **Urgency** *(Structural Risk)* | Cosmetic or convenience issue (e.g., loose hinge) | Damaged core utility without hazard (e.g., clogged drain) | Immediate safety risk or structural degradation (e.g., sparking wire) |
| **Impact** *(Scope Affected)* | Isolated strictly to a single individual's personal space | Affects a full apartment unit shared by multiple roommates | Affects a whole floor layout, building wing, or entire block |

### 5.2. Priority & SLA Target Mapping Matrix

| Impact \ Urgency | Score Level 1 (Low) | Score Level 2 (Medium) | Score Level 3 (High) |
| :--- | :--- | :--- | :--- |
| **Score Level 3 (High)** | **Medium Priority** (48h) | **High Priority** (12h) | **Critical Priority** (4h) |
| **Score Level 2 (Medium)** | **Medium Priority** (48h) | **Medium Priority** (48h) | **High Priority** (12h) |
| **Score Level 1 (Low)** | **Low Priority** (120h) | **Low Priority** (120h) | **Medium Priority** (48h) |

*   **Critical Priority:** 4-Hour SLA Target (Immediate emergency technician dispatch).
*   **High Priority:** 12-Hour SLA Target (Operational queue escalation).
*   **Medium Priority:** 48-Hour SLA Target (Standard maintenance window).
*   **Low Priority:** 120-Hour / 5-Day SLA Target (General cosmetic queue).

---

## 6. Student Handbook Rules & Penalty Fines

Wardens enforce rules during inspections, with violations resulting in standardized penalty rates:

### 6.1. Cleaning Standards (Flat RM10 Fine per Item)
*   Floor, Wall, Door
*   Cupboard, Desk, Bed
*   Mirror, Window
*   Kitchen Cabinets, Sink
*   Rubbish bin

### 6.2. Infrastructure, Safety & Conduct Fines
*   **Gas/Portable Stoves:** RM300 Fine + Potential Immediate Eviction.
*   **Fire Equipment Misuse:** RM50 Fine + Potential Immediate Eviction.
*   **Prohibited Safety Items:** RM50 - RM300 based on severity.
*   **Smoking:** RM250 Fine.
*   **Squatters:** RM50 Fine + Security Review/Eviction.
*   **Indecent Clothing:** RM50 Fine.
*   **Duplicating Keys:** RM50 Fine.
*   **Loss of Card/Keys/Tag:** RM30 Fine.

### 6.3. High-Value Damage Replacement Rates
*   **Air Conditioner:** RM1,500
*   **Digital Door Lock:** RM1,500
*   **Fridge:** RM1,000
*   **Premium Room Furniture (Bed, Cupboard, Study Table):** RM1,000 per item.
*   **Water Heater:** RM700

---

## 7. Project Milestone Checklist Details

### 7.1. Database Integration
*   Supabase and Prisma integration configured in `src/lib/prisma.ts` and `src/lib/db.ts` utilizing `DATABASE_URL` and `SKIP_DB`.
*   Active migrations saved in `prisma/migrations/20260219225804_milestone1_orcs_schema/migration.sql`.

### 7.2. Authentication & Scoping
*   Credentials-based NextAuth logic in `src/lib/auth.ts` with role-based redirects in `src/app/page.tsx`, `src/app/dashboard/page.tsx`, and `src/app/(auth)/login/page.tsx`.
*   Role guards implemented in `middleware.ts` and role normalization helpers in `src/lib/roles.ts`.
*   Initial project scope limits registration to the `Cendikiawan` hostel.

### 7.3. Complaint Management
*   API route configured at `POST /api/complaints`.
*   Student submission forms implemented in `src/components/shared/StudentComplaintForm.tsx` (binding student room context from `src/app/student/new/page.tsx`).
*   Server action hooks placed in `src/actions/complaints.ts`.
*   Shared dashboard navigation sidebar implemented in `src/components/shared/DashboardSidebar.tsx`.

---

## 8. QA Audit & Issues Resolution Log

A formal QA audit evaluated the system across **25+ pages**, **30+ API routes**, **10 Server Actions**, and **18 Database Models**. As of **2026-05-21**, the system has been certified as **PRODUCTION READY** with all Tier 1, Tier 2, and Tier 3 bugs resolved:

### 8.1. Resolved Bugs & Refactor Actions
*   **BUG-001 (Change Password Page):** Full functional form implemented with session updates, resolving the redirection loop.
*   **BUG-002 (Anonymous Messaging Crash):** Messaging returns a 422 payload for anonymous complaints with an explicit UI notification; GET APIs return an empty list with `anonymous: true`.
*   **BUG-003 (Status State Machine):** Enforced a strict forward-only transition sequence:
    *   `PENDING` → `IN_PROGRESS` or `CLOSED`
    *   `IN_PROGRESS` → `RESOLVED`, `PENDING`, or `CLOSED`
    *   `RESOLVED` → `CLOSED` or `IN_PROGRESS`
    *   `CLOSED` is a terminal state (no transitions allowed).
*   **BUG-004 (Category Deletion):** Blocked category deletion (returns 409) if complaints are active under it.
*   **BUG-005 (Default Password Leak):** Replaced hardcoded "123456" with `randomBytes` (10-char base64url) displayed only once to admin on user creation.
*   **BUG-006 (JWT Fallback Secret):** Added startup validation check (IIFE) that throws an error immediately if `AUTH_SECRET` is missing.
*   **BUG-007 (Soft-Delete Crash):** Preserved `studentProfileId` by adding a nullable `deletedAt` field to the database schema.
*   **H-001 (API Rate Limiting):** Implemented middleware limits of 10 requests/minute for complaints, 20 requests/minute for RAG chat, and 10 requests/minute for AI insights.
*   **H-002 (Category Validation):** Validates category updates against `AdminCategory.isActive` before committing to the DB.
*   **H-004 (System Health Cards):** Replaced hardcoded status widgets with actual DB ping check (`SELECT 1`) and environment variable checks for email and AI services.
*   **H-006 (Lockout Protection):** Enforces lockout for the remainder of a 15-minute window after 5 consecutive failed logins.
*   **M-001 (Notification History):** Paginated the notifications API (`?page=&limit=`) and returned total pages metadata.
*   **M-002 (Evidence File Uploads):** Server-side verification of magic-bytes MIME type whitelist and a strict 10 MB size limit.
*   **M-003 (SLA Cron Thresholds):** Replaced exact-day matching with `>= threshold` query ranges and a 24-hour run deduplication guard.
*   **M-004 (Warden Deletion Limits):** Allowed wardens to delete complaints belonging strictly to their assigned hostel scope.
*   **M-005 (PDF Export Failures):** Surfaced clear error messages advising users to utilize browser print fallback tools when generation fails.
*   **M-006 (Admin Redirects):** Configured automated redirects from `/admin/configuration` to `/admin/system`.
*   **M-008 (Mandatory Closure Reason):** Status transition to `CLOSED` requires a `closureNote` (minimum 10 characters) which is recorded as a `ComplaintUpdate`.
*   **M-009 (Anonymous Identity Masking):** API nulls student profiles for MANAGEMENT callers, and the UI displays an `EyeOff` banner for masked complaints.
*   **L-003 ("Back" Link):** Re-labeled to "Back to My Complaints".
*   **L-006 (Timezone Standardization):** Configured dates to render in Malaysia Time (MYT, UTC+8) using a shared helper `formatDateTimeMYT`.

---

## 9. Unresolved Limitations & Future Work (Tier 4 Backlog)

These items constitute the post-launch development backlog:
*   **RAG Memory Limits (`src/lib/ai/rag-vault.ts`):** Missing client-side chunk resizing using Web Workers to prevent uncompressed documents (>20MB) from crashing serverless memory.
*   **Offline Queue Cache (`src/components/shared/StudentComplaintForm.tsx`):** Lack of offline service worker queuing with IndexedDB to cache file records during network disruptions.
*   **Email Integration:** Admin email templates are stored, but active mail service SMTP is not configured.
*   **Student Acknowledgement:** No student-initiated closure or satisfaction survey (1-5 star ratings) exists.
*   **Bulk Actions:** Warden interface lack bulk-status updates for efficient ticket clearance.
*   **Database/Admin Cleanup:** Clean up unused models and JWT claims (`hostelId` in token, `AdminDepartment` model and API, `PolicyChunk` table, and `ComplaintEmbedding` metadata without active vector storage).
