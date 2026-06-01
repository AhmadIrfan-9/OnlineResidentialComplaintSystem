# UNITEN Online Residential Complaint System (UNITEN ORCS)
## Thesis Chapters 4, 5, 6, and 7

---

## Chapter 4: Design

### 4.1 System Architecture Overview
The Online Residential Complaint System (UNITEN ORCS) is architected as a decoupled, full-stack web application leveraging a serverless component model. The blueprint prioritizes transactional data integrity, low-latency UI responsiveness, and secure edge-based artificial intelligence triage. 

The modular system design isolates layers of responsibility to ensure scalability and ease of maintenance. The architectural structure of the application is represented below:

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

The system maintains a sharp boundary between client-side rendering elements and server-side resource engines. The **Client Layer** runs inside the student or staff web browser, communicating with the server solely via HTTPS REST requests and WebSockets. The **Application Layer** processes these requests, coordinating operations with the **Database Layer**, a real-time **Cache Layer** for notifications, and an **AI Inference Layer** that triages incoming tickets against institutional parameters.

---

### 4.2 Module and Interface Segment Breakdown

#### 4.2.1 Dual-Identifier Authentication Interface
This component controls application access gates. Moving away from rigid, single-attribute validation strings, the subsystem accepts either institutional emails or unique Student ID alphanumeric patterns.

> **[INSERT SCREENSHOT: Login Page showcasing the input box with placeholder text "Email or Student ID"]**

* **Visual Interface Description:** The login interface features a balanced single-card layout utilizing premium dark blue background headers designed to match the cognitive mental model of the UNITEN corporate ecosystem. Text inputs utilize high-contrast white typography over dark containers to ensure universal accessibility compliance. Focus rings utilize subtle HSL-tailored glow rings that shift state on user interaction to provide clear focus confirmation.
* **Operational Behavior:** The single input field binds to a generic identifier state machine. Input masking allows alphanumeric configurations (e.g., SW01084131) to parse smoothly alongside regular string email fields without triggering standard browser type errors. This dual-identity lookup occurs server-side during the initial authentication callback pass.

#### 4.2.2 Multi-Modal Student Complaint Form
The entry vehicle for system data collection. It guides students through structured drop-down fields and non-structured evidence collection fields.

> **[INSERT SCREENSHOT: New Complaint Form showing the 3-tier side-by-side dropdowns and the integrated drag-and-drop evidence area containing a selected image thumbnail]**

* **Visual Interface Description:** The room selection interface features a normalized, three-tier side-by-side dropdown element row spanning Block, Floor, and Unit. Beneath it sits a consolidated, single-bounding-box Evidence Files Dropzone outlined by a subtle dashed accent border. Selected image thumbnails render directly within this field container, featuring absolute-positioned deletion indicators.
* **Operational Behavior:** To prevent data pollution, the dropdown selectors strictly limit inputs to actual physical room inventories. The file preview layer uses unified states: selecting a file hides the empty-state cloud icon and replaces it with an inline thumbnail grid, preventing page layout shifting. The submit action compiles both JSON data payloads and binary media files into a structured multipart payload.

#### 4.2.3 Warden Analytics and Triage Command Center
The core administrative reporting screen where managing staff evaluate current operations.

> **[INSERT SCREENSHOT: Warden Analytics Dashboard showcasing the 50/50 Active vs. Resolved complaint cards and the Category Distribution Chart legend]**

* **Visual Interface Description:** The top dashboard area uses a symmetrical 50/50 horizontal split grid optimizing visual density. The left side houses the active work ticket tracking card, and the right monitors resolved closures. Below, a clean CategoryDistributionChart pie graphic uses contrasting data slices mapped to a unified text legend tracking structural categories (e.g., Plumbing, Furniture).
* **Operational Behavior:** Redundant secondary alert boxes have been eliminated from this view, deferring tracking entirely to the global navigation bell system. Pulsing alert indicators dynamically scale the visual hierarchy to highlight urgent tickets. Standard WebSocket socket tunnels stream updates onto the dashboard, automatically recalculating resolution metrics and updating status graphs without requiring manual browser page refreshes.

#### 4.2.4 Administrative User Management Console
The secure interface where system administrators input staff rosters, create new users, and map residential layout configurations.

> **[INSERT SCREENSHOT: Admin User Management screen showing the Create User modal with triple dropdown assignment inputs]**

* **Visual Interface Description:** A tabular administrative view overlaid with an input modal configuration. It incorporates the identical three-tier side-by-side dropdown component structure utilized in the student complaint module, ensuring UI uniformity across the design platform.
* **Operational Behavior:** Allows administrative personnel to rapidly bulk-provision user rows. When assigning rooms to newly created records, administrators click through sequential dropdown parameters to bind users to strict residential string profiles before persisting data. Validation checks guard against assigning wardens to hostels that already possess an active manager record.

---

### 4.3 Algorithmic and Decision Logic Design
To prevent subjective prioritization bias, the system handles triage classifications through an automated, server-side implementation of the standard ITIL (Information Technology Infrastructure Library) Framework. 

Priority calculation runs deterministically across an explicit matrix using the following equation:

$$\text{Priority} = \text{Impact} \times \text{Urgency}$$

| Evaluated Metric | Score Level 1 (Low) | Score Level 2 (Medium) | Score Level 3 (High) |
| :--- | :--- | :--- | :--- |
| **Urgency (Structural Risk)** | Cosmetic/Convenience issue (e.g., loose hinge). | Damaged core utility without hazard (e.g., clogged drain). | Immediate safety risk or structural degradation (e.g., sparking wire). |
| **Impact (Scope Affected)** | Isolated strictly to a single individual's personal space. | Affects a full apartment unit shared by multiple roommates. | Affects a whole floor layout, building wing, or entire block. |

The intersection of these data points generates an absolute string assignment tied to automated operational Service Level Agreements (SLA) via a deterministic mapping matrix:

| Impact \ Urgency | Score Level 1 (Low) | Score Level 2 (Medium) | Score Level 3 (High) |
| :--- | :--- | :--- | :--- |
| **Score Level 3 (High)** | **Medium Priority** (48h) | **High Priority** (12h) | **Critical Priority** (4h) |
| **Score Level 2 (Medium)** | **Medium Priority** (48h) | **Medium Priority** (48h) | **High Priority** (12h) |
| **Score Level 1 (Low)** | **Low Priority** (120h) | **Low Priority** (120h) | **Medium Priority** (48h) |

* **Critical Priority:** (Impact 3 & Urgency 3) $\rightarrow$ **4-Hour Resolution Target**. Immediate emergency technician dispatch.
* **High Priority:** $\rightarrow$ **12-Hour Resolution Target**. Operational queue escalation.
* **Medium Priority:** $\rightarrow$ **48-Hour Resolution Target**. Standard maintenance window.
* **Low Priority:** $\rightarrow$ **5-Day (120-Hour) Resolution Target**. General cosmetic queue.

---

## Chapter 5: Development

### 5.1 Technology Stack Specifications
The implementation lifecycle utilizes a modern, type-safe development framework stack selected to meet the specific security and operational uptime goals of the UNITEN CCI infrastructure:
* **Frontend Framework:** Next.js (Version 16 React Client Server Architecture Engine).
* **Styling Engine:** Tailwind CSS (compiled via utility-first PostCSS pipelines).
* **State & Authentication Middleware:** NextAuth.js incorporating secure JWT (JSON Web Tokens) transport layers.
* **Cryptography:** Client passwords are processed using a heavy-round bcryptjs hashing sequence prior to persistence.
* **Database Tooling:** Prisma Object-Relational Mapping (ORM) connecting to a hosted Postgres relational schema database.
* **Real-time Engine**: Socket.io utilizing Node server processes to broadcast notification payloads.

---

### 5.2 Core Feature Implementation Technical Highlights

#### 5.2.1 Multi-Identifier Authentication Integration
The authentication routine leverages server-side normalization to resolve the user record. When an identifier is submitted via the custom login page, the system decouples lookup dependencies using flexible logical operators:

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

This multi-clause evaluation matches the user against either index column. If a match is verified, the cryptographic hash is validated, and a type-safe token is signed, encapsulating user role-state tags (Student, Warden, Admin) directly within the runtime context.

#### 5.2.2 Automated ITIL AI Priority Triage Pipeline
The automated classification mechanism handles incoming multi-modal complaint streams by translating raw inputs into structured metadata. When a complaint is processed, binary media buffers and text strings are dispatched securely to the backend validation handler.

The system uses JSON Schema constraint forcing to ensure the AI output returns a clean, object-oriented payload, entirely stripping out conversational string fluff. The application captures the structured output values and writes them straight to the persistent database row, locking down the ticket's corresponding SLA hour targets.

---

## Chapter 6: Testing

### 6.1 Robustness Testing & Debugging Analysis
System evaluation followed a rigorous exploratory methodology. Rather than omitting mid-development pipeline failures, documenting significant codebase runtime crashes provides concrete empirical proof of the application's evolutionary stability.

```
[Runtime Error Encountered] ──► [Stack Trace Isolated]
                                      │
                                      ▼
[Root Cause Remediation & Code Modification Applied]
                                      │
                                      ▼
[Regression Verification Passed ──► Code Cleaned & Stable]
```

The table below catalogs the major system errors identified, diagnosed, and resolved during system optimization:

| Diagnostic Error Signature | Technical Root Cause Analysis | Systemic Fix Action Strategy |
| :--- | :--- | :--- |
| **Runtime SyntaxError:**<br>`Failed to execute 'json' on 'Response': Unexpected end of JSON input` | Client-side dashboard fetch code called `res.json()` synchronously on an API endpoint response that returned an empty body payload. | Refactored data retrieval code to fetch strings via `res.text()` first, performing a defensive content conditional ternary check: `text ? JSON.parse(text) : {}`. |
| **Virtual DOM Key Clash:**<br>`Encountered two children with the same key, Furniture.` | The analytics rendering engine encountered duplicate category names returned by database items containing accidental trailing user spaces. | Implemented an optimization pre-processing step using a JavaScript `.reduce()` array parser to aggregate category weights while changing loop keys to unique compound template strings: `key={\`${slice.name}-${index}\`}`. |
| **React Lifecycle Warning:**<br>`Cannot update a component while rendering a different component.` | The image capture component triggered parent state-setters synchronously inside its raw rendering lifecycle pass, triggering infinite loop guards. | Encapsulated child-to-parent callback triggers securely inside standard `useEffect` lifecycle synchronization wrappers, deferring notification loops to the next engine tick. |
| **Webpack Build Fail:**<br>`Module not found: Can't resolve 'pdf-parse'` | The RAG text-extraction code imported external dependencies that were not declared inside the local development environment workspace file manifest. | Executed full local package installs while deploying fallback exception configurations directly inside the central `next.config.js` compilation file. |
| **CI Git Push Protection Block:**<br>`pre-receive hook declined: Large files detected` | Local compilation routines accidentally staged a large compressed build archive (`.next.zip`, 503.57MB) directly into source control history. | Performed a soft Git history tracking reset, introduced explicit wildcard file exclusions inside the `.gitignore` manifest, and permanently purged tracking caches. |

---

## Chapter 7: Conclusion

### 7.1 Project Achievements Summary
The UNITEN CCI Residential Portal project successfully fulfills its design requirements. By moving away from basic, static HTML form patterns, the completed application delivers a robust system featuring intelligent multi-modal triage processing, strict side-by-side room database input normalization, and highly accessible user interface environments.

The architectural modularity and integration of NextAuth RBAC (Role-Based Access Control) ensures that administrative security requirements are fully enforced across all dashboards. Furthermore, the decoupling of the client and backend components guarantees that the UNITEN Residential Portal retains high stability, ready for dynamic university scaling.

---

### 7.2 Unresolved Issues & Limitations (Future Work)
To maintain academic transparency and project integrity, the remaining minor edge-case system parameters are cataloged in the table below. These entries serve as the direct roadmap for production release updates:

| File Location | Identified Structural Vulnerability / Unresolved Bug | Potential Operational Risk | Recommended Fix Strategy |
| :--- | :--- | :--- | :--- |
| **`src/lib/ai/rag-vault.ts`** | Missing automatic PDF file size pre-compression validation checking. | Uploads of uncompressed documents (>20MB) could crash serverless worker memory limits. | Integrate client-side chunk resizing using standard web workers. |
| **`src/components/shared/StudentComplaintForm.tsx`** | Lack of offline cache queuing states for media records. | Submitting reports inside poor Wi-Fi zones causes file loss and requires forms to be refilled. | Implement Service Worker storage arrays utilizing IndexedDB local temporary caching. |
| **`src/app/api/auth/login/route.ts`** | Absence of programmatic rate-limiting restrictions on the dual-identifier portal input. | Brute-force scripted dictionary attacks could attempt credential harvesting against Student ID sequences. | Configure automated up-stream IP connection-throttling middleware using Redis rate-limit counters. |
