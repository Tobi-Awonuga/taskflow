# CT Bakery — Masterplan Support Layer: Tool Catalog

All tools operate as an overlay on top of Masterplan. No ERP modification required.

---

## Ranked Tool List (by Priority)

| Rank | Tool | Priority | Type |
|------|------|----------|------|
| 1 | Item Creation Request & Approval Portal | CRITICAL | Form + Workflow |
| 2 | QA Receiving Checklist & Sign-Off | CRITICAL | Checklist + Workflow |
| 3 | Finished Goods Release Approval | CRITICAL | Workflow |
| 4 | Label Version Control Registry | CRITICAL | Registry + Workflow |
| 5 | Operations Dashboard | HIGH | Dashboard |
| 6 | Production Order Readiness Checklist | HIGH | Checklist |
| 7 | Raw Material Transfer Authorization | HIGH | Workflow |
| 8 | Lot Traceability Audit Report | HIGH | Report |
| 9 | SOP / Training Portal | HIGH | Knowledge Base |
| 10 | Shipping Verification Checklist | HIGH | Checklist |
| 11 | Cycle Count Scheduler & Tracker | MEDIUM | Workflow + Report |
| 12 | Yield Variance Alert | MEDIUM | Report |
| 13 | Audit Log Viewer | MEDIUM | Report |

---

## Detailed Tool Breakdown

---

### Tool 1: Item Creation Request & Approval Portal

**Problem it solves:**
Users freely create items in Masterplan without standardization or review. Duplicate items, incorrect UOM, missing GL codes, and naming inconsistencies cause downstream failures across POs, production, and reporting.

**Users:**
- Requesters: Purchasing, Production Planning, QA
- Approvers: QA Manager, Purchasing Manager, IT/ERP Admin

**Inputs:**
- Requested item name (with naming convention guidance)
- Item category / type (Raw Material, Packaging, Finished Good, Consumable)
- Unit of Measure (UOM)
- Supplier name (if applicable)
- Allergen flags
- Justification / business reason
- Similar existing item search results (to prevent duplicates)

**Outputs:**
- Structured request ticket with unique ID
- Email/in-app notifications to approvers
- Approval or rejection with comments
- Approved template sent to requestor to manually enter in Masterplan
- Audit trail of all requests and decisions

**Type:** Form + Approval Workflow + Audit Log

**Priority:** CRITICAL

**Notes:** Once approved, the requestor manually creates the item in Masterplan using the standardized template. This tool does NOT write to Masterplan.

---

### Tool 2: QA Receiving Checklist & Sign-Off

**Problem it solves:**
Warehouse staff complete receiving transactions in Masterplan without mandatory QA verification. Temperature-sensitive, allergen-containing, or non-conforming goods may be received into stock without proper inspection.

**Users:**
- Warehouse Receivers
- QA Inspectors / QA Manager

**Inputs:**
- PO number (manually entered, cross-referenced with printed PO)
- Supplier name
- Item received
- Lot/batch number from supplier CoA
- Temperature at receipt (if applicable)
- CoA present? (Yes/No)
- Physical inspection results (pass/fail checklist)
- Photo upload (optional)
- QA sign-off

**Outputs:**
- Completed digital receiving inspection record
- QA-approved receiving stamp (signal to warehouse to proceed in Masterplan)
- Rejected items go to Hold queue for disposition
- Audit log with timestamp and QA signatory

**Type:** Mobile-friendly Checklist + Digital Sign-Off

**Priority:** CRITICAL

---

### Tool 3: Finished Goods Release Approval

**Problem it solves:**
Finished goods can be transferred to shipping in Masterplan without a documented QA release. Products could ship before QA clearance.

**Users:**
- QA (release decision)
- Production Supervisor (initiates hold removal request)
- Shipping (consumes release status)

**Inputs:**
- Production order number
- Finished good item code and lot number
- Quantity produced
- QA test results (manually entered)
- Hold reason (if applicable)
- Release decision

**Outputs:**
- Hold status board visible to shipping team
- Release authorization document (PDF)
- Audit log of all release decisions

**Type:** Status Board + Workflow

**Priority:** CRITICAL

---

### Tool 4: Label Version Control Registry

**Problem it solves:**
Label templates are not version-controlled or linked to ERP item codes. Outdated labels with wrong allergen declarations are used after formula changes.

**Users:**
- QA / Regulatory
- Production / Packaging
- Label printing operators

**Inputs:**
- Item code (linked to Masterplan item)
- Label version number
- Label file (PDF, image)
- Approval date and approver
- Effective date
- Change reason / notes

**Outputs:**
- Current approved label registry per item
- Version history with change log
- Alerts when a new label version supersedes an old one
- Print-block on superseded versions (operator must acknowledge)

**Type:** Document Registry + Workflow

**Priority:** CRITICAL

---

### Tool 5: Operations Dashboard

**Problem it solves:**
No single view of operational health across receiving, production, QA holds, and shipping. Managers make decisions with stale or incomplete information.

**Users:**
- Plant Manager
- Operations Manager
- QA Manager
- Purchasing Manager

**Inputs:**
- Data exports from Masterplan (CSV/Excel via scheduled pull or manual upload)
- Real-time data from Tools 1–4 (stored in support layer database)

**Outputs:**
- Open POs vs. received today
- Items on QA hold (receiving + finished goods)
- Open production orders and status
- Pending item creation requests
- Shipments scheduled vs. confirmed
- Recent audit log activity

**Type:** Dashboard (KPI cards, tables, status indicators)

**Priority:** HIGH

---

### Tool 6: Production Order Readiness Checklist

**Problem it solves:**
Production orders are started without confirming BOM accuracy, ingredient availability, allergen line clearance, and equipment sanitation.

**Users:**
- Production Supervisor
- QA (allergen/sanitation sign-off)

**Inputs:**
- Production order number (manually referenced)
- BOM version confirmed? (Yes/No)
- All raw materials available? (Yes/No)
- Allergen line clearance completed? (Yes/No + signature)
- Equipment sanitation verified? (Yes/No + signature)
- Pre-op inspection passed? (Yes/No)

**Outputs:**
- Completed pre-production checklist with timestamp and signatures
- Digital record for FSMA/SQF audits
- Blocked start if checklist not completed

**Type:** Checklist + Digital Signatures

**Priority:** HIGH

---

### Tool 7: Raw Material Transfer Authorization

**Problem it solves:**
Raw materials are transferred to production without a linked, approved production order, creating traceability gaps and uncontrolled consumption.

**Users:**
- Warehouse (initiates transfer request)
- Production Planner (authorizes)

**Inputs:**
- Raw material item code and lot number
- Quantity requested
- Production order reference number
- Requested transfer date

**Outputs:**
- Authorized transfer slip (PDF) with production order reference
- Warehouse completes the actual transfer in Masterplan referencing this slip
- Audit log

**Type:** Authorization Form + Workflow

**Priority:** HIGH

---

### Tool 8: Lot Traceability Audit Report

**Problem it solves:**
Mock recalls require tracing a raw material lot through production to finished goods shipments. This is currently a manual, time-consuming paper chase.

**Users:**
- QA Manager
- Food Safety Team
- Senior Management

**Inputs:**
- Lot number OR item code OR supplier
- Date range

**Outputs:**
- Chain of custody: Received → Production Order → Finished Goods → Shipped To
- All data pulled from Masterplan exports + tool records
- Export to PDF or Excel

**Type:** Report / Traceability Tree

**Priority:** HIGH

---

### Tool 9: SOP / Training Portal

**Problem it solves:**
SOPs live in disparate Word documents, shared drives, and paper binders. New employees have no structured onboarding path. Updated SOPs don't reach operators.

**Users:**
- All departments
- Training Manager
- Supervisors

**Inputs:**
- SOP documents (uploaded as PDF/Word or written directly in portal)
- Training assignments (by role)
- User acknowledgements

**Outputs:**
- Searchable SOP library by department and process
- Training assignments with due dates
- Completion tracking per user
- Version-controlled SOP history

**Type:** Knowledge Base + Training Tracker

**Priority:** HIGH

---

### Tool 10: Shipping Verification Checklist

**Problem it solves:**
Shipments are confirmed in Masterplan without a documented physical verification of what was loaded on the truck.

**Users:**
- Shipping / Warehouse
- Shipping Supervisor

**Inputs:**
- Sales order / shipment reference
- Pallet count
- Item codes and quantities loaded
- Temperature at load (if applicable)
- Carrier name and trailer number
- BOL number
- Loader signature

**Outputs:**
- Completed shipping verification record
- Discrepancy alerts if loaded quantity differs from order
- Digital BOL attachment capability

**Type:** Checklist + Sign-Off

**Priority:** HIGH

---

### Tool 11: Cycle Count Scheduler & Tracker

**Problem it solves:**
No enforced cycle count schedule. High-value or allergen-containing inventory can go uncounted for months.

**Users:**
- Inventory Control / Warehouse Lead
- Finance (for variance review)

**Inputs:**
- Cycle count schedule (weekly/monthly per zone/item category)
- Actual count results (manually entered, compared to Masterplan export)
- Variance notes

**Outputs:**
- Count schedule calendar
- Variance report
- Trend analysis of accuracy over time

**Type:** Scheduler + Report

**Priority:** MEDIUM

---

### Tool 12: Yield Variance Alert

**Problem it solves:**
Significant differences between expected and actual production yield go unnoticed until month-end.

**Users:**
- Production Supervisor
- Finance / Cost Accounting

**Inputs:**
- Production order expected yield (from Masterplan export)
- Actual yield (entered by production supervisor at order close)

**Outputs:**
- Variance calculation and % deviation
- Flag if deviation exceeds threshold (e.g., ±5%)
- Root cause entry required if flagged

**Type:** Form + Alert + Report

**Priority:** MEDIUM

---

### Tool 13: Audit Log Viewer

**Problem it solves:**
No centralized log of user actions across the support layer tools. Cannot investigate who approved what, when, and why.

**Users:**
- QA Manager
- IT Admin
- Plant Manager

**Inputs:**
- Automatic log entries from all tools in the support layer

**Outputs:**
- Searchable, filterable audit log
- Who, what, when for every action
- Export to CSV

**Type:** Report / Log Viewer

**Priority:** MEDIUM

---

## Tool Interaction Map

```
Masterplan ERP (READ ONLY via exports or browser extraction)
        |
        v
+------------------------+       +---------------------------+
| Operations Dashboard   |<------| All Tools (data feeds in) |
+------------------------+       +---------------------------+
        ^
        |
+-------+--------+-----------+----------+----------+
|                |           |          |          |
Tool 1        Tool 2      Tool 3     Tool 4    Tool 9
Item          QA          FG         Label      SOP
Request       Receiving   Release    Registry   Portal
              Checklist   Approval
```
