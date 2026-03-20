# CT Bakery — Masterplan ERP: Operational Risks & Inefficiencies

## Overview

This document identifies the most significant operational risks and inefficiencies in CT Bakery's ERP-based manufacturing workflows. All risks are observed through the lens of operating Masterplan ERP without direct database access or the ability to modify the ERP itself.

---

## Risk Category 1: Item Master Integrity

### Risk 1.1 — Uncontrolled Item Creation
**Severity: CRITICAL**

- Any user with sufficient permissions can create new items in Masterplan.
- No standardized naming convention is enforced.
- Duplicate items are created when users can't find an existing item.
- Missing or incorrect Unit of Measure (UOM) causes conversion errors downstream.
- Items created without proper GL code mapping break financial reporting.

**Downstream Impact:**
- PO receiving fails or goes to wrong location
- Raw material transfers can't find correct item
- Inventory reports show phantom stock
- Costing inaccuracies propagate to production orders

### Risk 1.2 — Inactive Item Usage
**Severity: HIGH**

- Discontinued or inactive items may still appear in searches.
- Users accidentally use old item codes on purchase orders and production orders.
- Results in incorrect inventory movements and reconciliation headaches.

---

## Risk Category 2: Purchase Order Receiving

### Risk 2.1 — Over-Receiving Without Authorization
**Severity: HIGH**

- Warehouse staff can receive quantities beyond PO amounts without mandatory escalation.
- Supplier pricing variances go unreviewed until month-end.
- Temperature-sensitive ingredients (fats, dairy) received without mandatory quality hold.

### Risk 2.2 — Wrong Location Putaway
**Severity: HIGH**

- No system-enforced location assignment at receiving.
- Allergen-sensitive items (nuts, dairy) putaway in wrong zones creates cross-contamination risk.
- Frozen vs. ambient products mixed in storage.

### Risk 2.3 — Receiving Without Quality Check
**Severity: CRITICAL**

- No mandatory QA sign-off step before completing a receiving transaction in Masterplan.
- Certificate of Analysis (CoA) validation done on paper, disconnected from ERP.
- High-risk ingredients (allergens, preservatives) pass receiving without QA confirmation.

---

## Risk Category 3: Raw Material Transfer Orders

### Risk 3.1 — Transfer Without Production Authorization
**Severity: HIGH**

- Raw material transfers to production floor can happen without a corresponding production order.
- Materials consumed without traceable production batch creates FSMA/traceability gaps.
- Excess transfers inflate production cost and hide material variances.

### Risk 3.2 — Batch/Lot Number Skipping
**Severity: HIGH**

- Users may skip lot number entry when transferring ingredients.
- Breaks lot traceability required for food safety recalls.
- Cannot perform a complete mock recall if lot data is missing.

---

## Risk Category 4: Production Orders

### Risk 4.1 — Production Started Without Approved Formula/BOM
**Severity: CRITICAL**

- No gate to prevent starting production with an unapproved or outdated Bill of Materials.
- Formula changes made informally (verbal, paper) never reflected in ERP.
- Allergen declarations on finished goods labels may not match actual formula.

### Risk 4.2 — Yield Variance Not Flagged
**Severity: MEDIUM**

- Actual yield significantly different from expected yield is not automatically escalated.
- Over-reporting yield hides waste; under-reporting creates ghost inventory.

### Risk 4.3 — Labor and Machine Time Not Captured
**Severity: MEDIUM**

- Production orders closed without capturing actual labor hours or machine run time.
- Costing inaccurate; capacity planning cannot be done with confidence.

---

## Risk Category 5: Finished Goods Transfer Orders

### Risk 5.1 — Finished Goods Released Without QA Hold
**Severity: CRITICAL**

- No mandatory QA hold status before finished goods can be transferred to the shipping area.
- Product could be loaded and shipped before QA release.
- Regulatory non-compliance risk (FSMA, SQF, customer requirements).

### Risk 5.2 — FIFO Not Enforced
**Severity: HIGH**

- Users can select any lot when picking finished goods.
- Oldest inventory may sit while newer stock ships.
- Customer complaints about short shelf life increase.

---

## Risk Category 6: Shipping / Sales Orders

### Risk 6.1 — Short Ship or Over Ship
**Severity: HIGH**

- No mandatory weight/count verification step linked to ERP before shipping confirmation.
- Short shipments discovered by customers cause service failures.

### Risk 6.2 — Wrong Label on Pallet
**Severity: CRITICAL**

- Label printing is disconnected from shipment confirmation.
- Multiple label versions for same item; no control on which version is printed.
- Allergen mislabeling risk — FDA recall risk.

### Risk 6.3 — Missing BOL / Carrier Documentation
**Severity: HIGH**

- Bill of Lading not attached to sales order record.
- Claims and disputes cannot be resolved without documentation.

---

## Risk Category 7: Inventory Control

### Risk 7.1 — Cycle Count Gaps
**Severity: MEDIUM**

- No enforced cycle count schedule in Masterplan.
- High-value or high-risk items may go uncounted for months.
- Book vs. physical variances accumulate undetected.

### Risk 7.2 — Negative Inventory
**Severity: HIGH**

- Masterplan may allow negative inventory if receiving is delayed.
- Negative inventory causes incorrect COGS and misleading availability reports.

---

## Risk Category 8: Label Workflows

### Risk 8.1 — Label Version Control
**Severity: CRITICAL**

- No centralized label version registry linked to ERP item codes.
- Old label templates used after ingredient or allergen changes.
- Regulatory non-compliance and potential recall exposure.

### Risk 8.2 — Label Approval Bypass
**Severity: HIGH**

- New or revised labels can be printed without a documented approval from QA/Regulatory.

---

## Summary Risk Matrix

| Risk | Category | Severity | Frequency | Traceability Impact |
|------|----------|----------|-----------|---------------------|
| Uncontrolled item creation | Item Master | CRITICAL | High | High |
| QA not linked to receiving | Receiving | CRITICAL | High | High |
| Finished goods no QA hold | FG Transfer | CRITICAL | Medium | Very High |
| Wrong label / allergen | Shipping | CRITICAL | Low-Medium | Very High |
| Formula not approved | Production | CRITICAL | Medium | High |
| Batch lot skipping | Transfers | HIGH | Medium | Very High |
| Over-receiving | Receiving | HIGH | Medium | Medium |
| FIFO not enforced | FG Transfer | HIGH | High | Medium |
| Cycle count gaps | Inventory | MEDIUM | Continuous | Low |
| Yield variance | Production | MEDIUM | High | Medium |
