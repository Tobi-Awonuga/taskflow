# CT Bakery — Masterplan Support Layer: MVP Roadmap

---

## Guiding Principles

- Ship fast, learn fast.
- Each phase must deliver standalone operational value.
- Start with highest-risk, highest-frequency pain points.
- Don't wait for perfection — paper reduction and control are the goal.

---

## Phase 1 — Control & Safety (Weeks 1–6)
**Theme: Stop the bleeding. Prevent the most dangerous errors NOW.**

### Deliverables

| Tool | Why Now |
|------|---------|
| Item Creation Request & Approval Portal | Uncontrolled item creation is the #1 source of cascading errors |
| QA Receiving Checklist (digital) | Food safety risk — ingredients received without QA sign-off |
| Finished Goods Release Status Board | Regulatory risk — FG shipped without QA clearance |
| Basic Audit Log | Visibility into who is doing what in the support layer |

### Success Metrics
- Zero new Masterplan items created without an approved request ticket
- 100% of receiving events have a linked digital QA checklist
- Zero FG transfers without a QA release record
- Full audit trail for all support layer actions

### Technical Scope
- Backend: Node.js + Express + SQLite + Prisma
- Frontend: Simple Vite + Vanilla JS app
- Auth: Basic username/password (role-based: requester, approver, QA, admin)
- Deployment: Internal server or VPS (no cloud required)

---

## Phase 2 — Visibility & Standardization (Weeks 7–14)
**Theme: Give managers a real-time view. Give operators guardrails.**

### Deliverables

| Tool | Why Now |
|------|---------|
| Operations Dashboard | Managers need a single pane of glass |
| SOP / Training Portal | Standardize procedures; reduce training gaps |
| Production Order Readiness Checklist | Pre-production gate; allergen line clearance |
| Raw Material Transfer Authorization | Traceability compliance |
| Label Version Control Registry | Allergen mislabeling prevention |

### Success Metrics
- Operations Dashboard adopted by Plant Manager and QA Manager daily
- All active SOPs loaded and acknowledged by relevant teams
- Pre-production checklist completion rate > 95%
- All FG label versions tracked with approval status

### Technical Scope
- Dashboard data: Masterplan CSV exports (manual upload or Playwright pull)
- SOP portal: File uploads + in-app richtext
- Label registry: Document upload + version history

---

## Phase 3 — Intelligence & Automation (Weeks 15–24)
**Theme: Connect the dots. Surface insights. Reduce manual work.**

### Deliverables

| Tool | Why Now |
|------|---------|
| Lot Traceability Audit Report | Mock recall readiness; FSMA compliance |
| Yield Variance Alert | Cost visibility; production efficiency |
| Cycle Count Scheduler & Tracker | Inventory accuracy; financial integrity |
| Shipping Verification Checklist | Short ship prevention; BOL management |
| Playwright Automation: Masterplan Data Extraction | Reduce manual export burden |

### Success Metrics
- Mock recall executed end-to-end in < 30 minutes (vs. current 4+ hours)
- Yield variance caught within 24 hours of production close
- Cycle count schedule 100% adherence
- All shipments have a digital verification record

### Technical Scope
- Playwright scripts to auto-pull PO, inventory, and production data from Masterplan
- Scheduled jobs (cron) to refresh dashboard data
- Email/SMS notifications for alerts

---

## Phase Summary

```
PHASE 1 (Weeks 1-6)         PHASE 2 (Weeks 7-14)         PHASE 3 (Weeks 15-24)
━━━━━━━━━━━━━━━━━━━         ━━━━━━━━━━━━━━━━━━━━         ━━━━━━━━━━━━━━━━━━━━━
✓ Item Request Portal        ✓ Operations Dashboard        ✓ Traceability Report
✓ QA Receiving Checklist     ✓ SOP Portal                  ✓ Yield Variance Alerts
✓ FG Release Status          ✓ Production Checklist        ✓ Cycle Count Tracker
✓ Audit Log                  ✓ RM Transfer Auth            ✓ Shipping Verification
                             ✓ Label Version Registry      ✓ Playwright Automation
```

---

## Resource Estimate

| Phase | Dev Effort | Who Needs to Be Involved |
|-------|-----------|--------------------------|
| Phase 1 | 3–4 weeks (1 developer) | QA Manager, Purchasing Manager, IT |
| Phase 2 | 4–6 weeks (1 developer) | All department heads, Training |
| Phase 3 | 6–8 weeks (1 developer) | IT, QA, Finance, Operations |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Users bypass the portal and create items directly in Masterplan | Permission audit in Masterplan; manager accountability |
| Low adoption of digital checklists | Keep forms simple and mobile-friendly; train supervisors first |
| Masterplan export format changes | Build flexible CSV parsers; document expected format |
| Playwright breaks if Masterplan UI changes | Modular scripts with clear selectors; version-lock approach |
