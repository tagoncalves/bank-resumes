# Manual Parser Training Plan

## Objective

Add a manual admin-assisted flow to define payslip/statement parsers when native parsing and AI-assisted parsing fail.

The goal is to let an admin visually identify where fields live in the PDF, save those anchors, generate a deterministic parser from them, test it immediately against the same PDF, and then approve it for reuse.

This must not replace the existing automatic flow. It is a fallback/manual-training path.

## Current Problem

- Some PDFs produce unusable text extraction.
- OCR may still be noisy or incomplete.
- The LLM hallucinates plausible-but-false values.
- Fidelity validation correctly rejects those values, but the system still cannot recover.
- We need a human-in-the-loop path to teach the system the actual layout.

## Findings From Failed Automatic Attempts

- Some receipts expose broken text layers such as `(cid:NN)` sequences or non-printable garbage.
- Even when OCR fallback runs, the resulting text may still be too noisy to support reliable field extraction.
- The LLM may return plausible but false employer/employee/period values that do not exist in the PDF.
- Post-analysis validation is useful and should remain, but it only proves the automatic path failed; it does not provide a recovery path.
- For these documents, the correct recovery path is explicit user-guided anchoring, not more retries or prompt tweaks.

## Scope

Initial scope should focus on `PAYSLIP` because that is the current blocker.

Design should still support both:
- `PAYSLIP`
- `STATEMENT`

## Product Flow

1. Admin opens a failed or queued document.
2. Admin clicks `Train Parser` or equivalent action.
3. System renders the PDF in a viewer.
4. Admin selects regions for required fields.
5. Admin confirms extracted values for each field.
6. System stores training anchors and generates a parser draft.
7. System runs the generated parser against the same PDF.
8. Admin reviews the extracted result.
9. If valid, admin approves the parser.
10. Document is reprocessed with the trained parser and moves to `PRELIMINARY` or `COMPLETED` depending on the existing business rules.

## Required Fields

### Payslip

Required:
- `employer_name`
- `employee_name`
- `period_label`
- `pay_date`
- `net_amount_ars`

Optional:
- `gross_amount_ars`
- `bank_name`

### Statement

Required:
- `bank_name`
- `holder_name`
- `card_last_four`
- `card_network`
- `period_start`
- `period_end`
- `due_date`

Balance summary fields and transaction table support can be phased in later.

## UX Plan

### Admin Entry Points

Add actions in admin/review areas:
- `Train Parser`
- `Test Parser`
- `Approve Parser`
- `Reject Parser`

Suggested places:
- `web/src/app/admin/review-statements/page.tsx`
- payslip detail page
- statement detail page

### PDF Training Screen

Core UI pieces:
- PDF viewer with page navigation
- overlay for rectangular selection
- field list panel
- current selected value preview
- manual text override input
- parser test results panel

Workflow per field:
1. Select field name.
2. Draw/select region on PDF.
3. System captures page + bbox.
4. System tries to extract raw text from that region.
5. Admin confirms or edits the extracted value.
6. Save anchor.

Important requirement:
- the UI must allow manual confirmation even when OCR/text extraction for that region is bad or empty.
- the admin-confirmed value is the source of truth for parser training.

### Selection Modes

Support these modes:
- `region_exact`: use the exact selected region
- `right_of_label`: selected region contains label; value is to the right
- `below_label`: selected region contains label; value is below
- `row_capture`: capture full row from a table-like line

Initial version can start with only:
- `region_exact`
- `right_of_label`

## Data Model Plan

Add a new Prisma model, for example:

```prisma
model ParserTrainingAnchor {
  id            String   @id @default(cuid())
  aiParserId    String?
  payslipId     String?
  statementId   String?
  sourceType    String   // PAYSLIP | STATEMENT
  fieldName     String
  pageNumber    Int
  x0            Float
  top           Float
  x1            Float
  bottom        Float
  mode          String   // region_exact | right_of_label | below_label | row_capture
  rawText       String?
  confirmedText String?
  labelText     String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

Alternative:
- store anchors as JSON on `AiParser`

Recommendation:
- use a separate table because anchors are first-class training data and easier to query/audit.

## Backend Plan

### APIs

Add endpoints for:

1. Load training context
- `GET /api/admin/ai-parsers/training/:sourceType/:id`

Returns:
- document metadata
- file URL
- current parser status
- existing anchors

2. Save/update anchor
- `POST /api/admin/ai-parsers/training/anchor`

Input:
- `sourceType`
- `sourceId`
- `fieldName`
- `pageNumber`
- `bbox`
- `mode`
- `rawText`
- `confirmedText`
- `labelText`

3. Generate parser draft from anchors
- `POST /api/admin/ai-parsers/training/generate`

Input:
- `sourceType`
- `sourceId`

Output:
- generated parser code
- extracted structured result from test run
- validation notes

4. Test parser against document
- `POST /api/admin/ai-parsers/training/test`

5. Approve parser
- existing parser admin flow can likely be reused

### Parser Generation Strategy

Do not generate parser code from vague label lists alone.

Generate from:
- anchor regions
- extraction mode
- label text
- normalization rules
- admin-confirmed ground-truth value from the training sample

The generated parser should be deterministic.

For `PAYSLIP`, a generated parser can use this approach:
- load PDF text/words with coordinates
- read words within bbox
- optionally search right-of-label on same row
- normalize final string into date/amount/text

## Parser Runtime Strategy

The generated parser should not depend on the LLM.

Use deterministic extraction:
- coordinates
- neighboring words
- row alignment
- regex normalization

Suggested runtime steps:
1. Extract words with positions.
2. Locate the anchor page/region.
3. Apply extraction mode.
4. Normalize result according to field type.
5. Return structured object.

## Testing Strategy

### Manual Test

For each trained parser:
1. Train on one failed PDF.
2. Test on the same PDF.
3. Confirm extracted values match user-confirmed text.

### Regression Test

Add snapshot fixtures later for:
- raw OCR/text sample
- anchor set
- expected extracted fields

### Validation Rules

Keep fidelity validation, but prefer anchor-aware validation:
- value should come from the trained region or derived neighbor region
- validation should not rely only on global text inclusion
- manual training test should compare parser output against admin-confirmed values, not only OCR text presence

## Suggested Implementation Phases

### Phase 1

Minimal manual training for payslips:
- PDF viewer
- region selection
- save anchors
- generate parser draft
- test draft on same PDF

### Phase 2

Admin approval workflow:
- approve/reject parser
- show extracted output and diffs
- reprocess original document with trained parser

### Phase 3

Generalization:
- support statements
- support row/table extraction
- support multiple sample PDFs per parser

### Phase 4

Quality improvements:
- version parser revisions
- compare extraction across versions
- confidence scoring based on anchor stability

## Recommended File/Area Changes

### Web

- `web/prisma/schema.prisma`
- new training API routes under `web/src/app/api/admin/ai-parsers/`
- new admin UI screen/components for PDF selection training
- existing parser admin store/components

Possible files:
- `web/src/app/admin/ai-parsers/...`
- `web/src/components/admin/parser-training/...`
- `web/src/stores/parser-admin.ts`

### Parser Service or Shared Extraction Layer

If parser training needs reliable coordinate extraction, consider exposing a backend endpoint that returns words with bbox for a given PDF.

Possible additions:
- parser service endpoint for word extraction by page
- shared contract for word coordinates

## Open Questions

1. Should the training UI use browser-native PDF text selection or a custom canvas overlay?
2. Should anchors be stored per parser version or per source document first?
3. Should one parser require one sample or multiple samples before approval?
4. Should trained parsers be source-specific at first, then generalized later?
5. Should approval automatically reprocess only the current document or also retry matching queued documents?

## Recommended Defaults

- Start with payslips only.
- Start with one-sample training.
- Store anchors in a dedicated table.
- Generate deterministic parser drafts.
- Require explicit admin approval before reuse.
- Reprocess only the current document on first release.
- Do not block training on OCR quality; allow manual override text per field.

## Handoff Notes For Another Agent

When implementing:
- preserve current `PRELIMINARY`/confirm/reject flow
- do not remove AI flow; add manual training as fallback
- avoid coupling training flow to LLM success
- prioritize deterministic extraction and auditability
- make sure generated parsers for `PAYSLIP` are not built using statement models/shapes
