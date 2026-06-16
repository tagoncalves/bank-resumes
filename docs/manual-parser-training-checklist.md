# Manual Parser Training Implementation Checklist

## Goal

Implement a manual admin-assisted parser training flow for failed `PAYSLIP` documents without changing the existing business flow around `PRELIMINARY`, confirm, reject, and reprocess.

## Phase 1: Data Model

- [ ] Add `ParserTrainingAnchor` Prisma model.
- [ ] Decide whether anchors link directly to `Payslip`/`Statement`, `AiParser`, or both.
- [ ] Include fields for:
  - [ ] `sourceType`
  - [ ] `fieldName`
  - [ ] `pageNumber`
  - [ ] `x0`, `top`, `x1`, `bottom`
  - [ ] `mode`
  - [ ] `rawText`
  - [ ] `confirmedText`
  - [ ] `labelText`
- [ ] Run Prisma migration or `db:push` according to repo convention.

## Phase 2: Admin Training API

- [ ] Add endpoint to fetch training context.
- [ ] Add endpoint to save/update one anchor.
- [ ] Add endpoint to list anchors for a source document.
- [ ] Add endpoint to generate parser draft from anchors.
- [ ] Add endpoint to test parser draft against the source PDF.
- [ ] Reuse or extend existing approve/reject parser endpoints when possible.

Suggested route area:
- [ ] `web/src/app/api/admin/ai-parsers/training/...`

## Phase 3: PDF Training UI

- [ ] Add admin screen for parser training.
- [ ] Render the PDF in a viewer with page navigation.
- [ ] Add rectangular selection overlay.
- [ ] Add field list for required payslip fields.
- [ ] Show raw extracted text from selected region.
- [ ] Allow manual override of extracted text.
- [ ] Save anchor per field.
- [ ] Show completion state for each required field.

Required fields for v1:
- [ ] `employer_name`
- [ ] `employee_name`
- [ ] `period_label`
- [ ] `pay_date`
- [ ] `net_amount_ars`

Optional fields for v1:
- [ ] `gross_amount_ars`
- [ ] `bank_name`

## Phase 4: Deterministic Parser Draft Generation

- [ ] Generate parser code from anchors, not from LLM labels.
- [ ] Support `region_exact` mode in v1.
- [ ] Optionally support `right_of_label` in v1 if cheap.
- [ ] Normalize field values by type:
  - [ ] string
  - [ ] date
  - [ ] money
- [ ] Persist parser draft in `AiParser`.
- [ ] Save parser file if current architecture still requires on-disk Python files.

## Phase 5: Immediate Parser Test

- [ ] Run generated parser against the same PDF used for training.
- [ ] Compare extracted values with admin-confirmed values.
- [ ] Show field-by-field pass/fail results.
- [ ] Block approval if required fields do not match.

## Phase 6: Approval and Reprocessing

- [ ] Add admin action to approve the parser after a passing test.
- [ ] Reprocess the current payslip with the approved parser.
- [ ] Keep existing states intact:
  - [ ] `QUEUED`
  - [ ] `ANALYZING`
  - [ ] `PRELIMINARY`
  - [ ] `COMPLETED`
  - [ ] `FAILED`
- [ ] Do not auto-create transactions before the existing confirmation step unless the current flow already allows it.

## Phase 7: Auditability

- [ ] Store who trained the parser.
- [ ] Store when each anchor was created/edited.
- [ ] Store confirmed values used during training.
- [ ] Store parser test results.
- [ ] Make the training history visible in admin.

## Phase 8: Nice-To-Have Follow-Ups

- [ ] Multiple training samples per parser.
- [ ] Statement support.
- [ ] Table row extraction mode.
- [ ] Overlay previews showing saved anchors on the PDF.
- [ ] Diff view between OCR text and admin-confirmed value.

## Acceptance Criteria

- [ ] An admin can train a parser on a failed payslip without relying on AI success.
- [ ] The admin can manually confirm each field even if OCR text is poor.
- [ ] The system generates a deterministic parser draft from those anchors.
- [ ] The parser can be tested immediately against the source PDF.
- [ ] Approval reuses the trained parser in the existing review workflow.

## Guardrails

- [ ] Do not remove the current automatic flow.
- [ ] Do not make parser training depend on successful LLM extraction.
- [ ] Do not trust OCR text as the only source of truth during training.
- [ ] Keep changes minimal and isolated to admin/training flows where possible.
