# CT Bakery — Masterplan Support Layer: Technical Architecture

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USERS (Browser)                             │
│   Warehouse  │  QA  │  Production  │  Purchasing  │  Management     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SUPPORT LAYER WEB APP                             │
│                  (Internal server / VPS)                             │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                        FRONTEND                               │  │
│  │          Vite + Vanilla JS (SPA)                              │  │
│  │                                                               │  │
│  │  Pages:                                                       │  │
│  │  • Dashboard          • Item Request Portal                   │  │
│  │  • QA Receiving       • FG Release Board                      │  │
│  │  • SOP Portal         • Audit Log Viewer                      │  │
│  │  • Label Registry     • Production Checklist                  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                               │                                      │
│                    REST API calls (JSON)                             │
│                               │                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                        BACKEND                                │  │
│  │          Node.js + Express.js                                 │  │
│  │                                                               │  │
│  │  Route Groups:                                                │  │
│  │  /api/auth              Authentication & sessions             │  │
│  │  /api/item-requests     Item creation workflow                │  │
│  │  /api/qa-checklists     Receiving & FG checklists             │  │
│  │  /api/fg-releases       FG hold/release workflow              │  │
│  │  /api/dashboard         Aggregated KPI data                   │  │
│  │  /api/sops              SOP documents & training              │  │
│  │  /api/labels            Label version registry                │  │
│  │  /api/audit-logs        System-wide audit trail               │  │
│  │  /api/uploads           File upload handling                  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                               │                                      │
│                    Prisma ORM (type-safe queries)                    │
│                               │                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                       DATABASE                                │  │
│  │              SQLite (file-based, zero-config)                 │  │
│  │                                                               │  │
│  │  Tables:                                                      │  │
│  │  users            item_requests      approvals                │  │
│  │  qa_checklists    checklist_items    fg_releases              │  │
│  │  sop_documents    label_versions     audit_logs               │  │
│  │  masterplan_data  (cached exports)                            │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                               │
              ┌────────────────┴─────────────────┐
              │                                   │
              ▼                                   ▼
┌─────────────────────────┐       ┌──────────────────────────────────┐
│  MASTERPLAN ERP          │       │  PLAYWRIGHT AUTOMATION            │
│  (READ ONLY)             │       │  (Scheduled or on-demand)        │
│                          │       │                                  │
│  https://preview.master- │◄──────│  • Login to Masterplan           │
│  plansolutions.com/      │       │  • Navigate to reports           │
│                          │       │  • Extract: PO data, inventory,  │
│  ✓ PO Receiving          │       │    production orders, item list  │
│  ✓ RM Transfer Orders    │       │  • Save as JSON/CSV              │
│  ✓ FG Transfer Orders    │       │  • POST to /api/masterplan-data  │
│  ✓ Inventory             │────── │                                  │
│  ✓ Production Orders     │ CSV   │  Scripts:                        │
│  ✓ Sales Orders          │ Export│  extract-pos.js                  │
│  ✓ Label Workflows       │       │  extract-inventory.js            │
└─────────────────────────┘       │  extract-production.js           │
                                   │  audit-item-master.js            │
                                   └──────────────────────────────────┘
```

---

## Data Flow

### 1. Item Creation Request Flow
```
Requester fills form → Support Layer DB → Email to Approvers
                                        ↓
                              Approver reviews in portal
                                        ↓
                    Approved → Standardized template sent to requester
                    Rejected → Rejection reason sent to requester
                                        ↓
                    Requester manually creates item in Masterplan
                    using the approved template
                                        ↓
                         Audit log entry created
```

### 2. QA Receiving Flow
```
PO arrives → Warehouse initiates receiving checklist in portal
                         ↓
              QA inspector completes inspection form
              (temp, CoA, visual check, allergen verification)
                         ↓
            Pass → QA digital sign-off → Warehouse completes
                   Masterplan receiving transaction
                         ↓
            Fail → Item placed on digital Hold → QA disposition
                   workflow initiated
```

### 3. Finished Goods Release Flow
```
Production closes order → FG automatically placed on "Pending QA" status
in support layer (sourced from production order checklist)
                         ↓
              QA enters test results → Release decision
                         ↓
            Released → Shipping team sees "Released" status
                       Shipping can proceed in Masterplan
                         ↓
            Held → Hold reason logged → Disposition workflow
```

### 4. Dashboard Data Refresh Flow
```
Scheduled cron job (or manual trigger)
         ↓
Playwright script logs into Masterplan
         ↓
Navigates to PO report, Inventory report, Production Order report
         ↓
Extracts data, saves to /tmp as CSV
         ↓
Script POSTs data to /api/masterplan-data
         ↓
Backend parses and stores in SQLite (masterplan_data table)
         ↓
Dashboard queries cached data + live support layer data
         ↓
Rendered to user
```

---

## Security Considerations

| Concern | Approach |
|---------|---------|
| Masterplan credentials | Stored in `.env` file, never committed to git |
| Support layer auth | JWT tokens, role-based access control |
| Sensitive data at rest | SQLite file permissions restricted to app user |
| File uploads (CoA, labels) | Stored in `/uploads` directory, served with auth check |
| Audit trail | Every mutation logged with user ID, timestamp, before/after |
| HTTPS | Nginx reverse proxy with SSL certificate |

---

## Deployment Architecture (Simple)

```
Ubuntu VPS / Internal Windows Server
├── Node.js app (pm2 process manager)
│   ├── Backend: port 3000
│   └── Frontend: built static files served by Express
├── Nginx reverse proxy (port 80/443 → 3000)
├── SQLite database file (/data/support-layer.db)
├── Uploads directory (/data/uploads/)
└── Playwright runner (cron job, runs 6am and 2pm daily)
```

---

## Why These Technology Choices

| Choice | Reason |
|--------|--------|
| SQLite | Zero-config, single file, no DBA required, sufficient for <50 concurrent users |
| Prisma | Type-safe queries, easy migrations, great DX |
| Node.js / Express | Same stack as existing tools, easy to maintain |
| Vanilla JS frontend | No build complexity, fast, no framework dependency |
| Playwright | Best-in-class browser automation, reliable selectors, handles SPAs |

---

## Future Considerations (Phase 3+)

- **Masterplan API:** If Masterplan exposes a REST API, replace Playwright extraction with direct API calls.
- **PostgreSQL migration:** If user count grows beyond 50 or data volume increases, migrate SQLite → PostgreSQL with minimal schema changes (Prisma makes this easy).
- **Email notifications:** Integrate with SendGrid or internal SMTP for approval alerts.
- **Mobile app:** Wrap the web app in a PWA for warehouse floor use on tablets.
