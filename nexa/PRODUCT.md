# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: HR staff working on a desktop browser (confirmed by the product owner). They set up and run the system, import data, approve requests, run evaluations and read reports.

Also served, observed in the code and roles but not confirmed as primary: about 85–90 Gadget Villa employees using the installed web app (PWA) on phones to check in, request leave/OT, read announcements and answer evaluations; line managers who approve their team's requests and rate their people; finance, who handle payroll, expenses and loans. Many employees are warehouse and delivery staff on mid-range Android phones, often in a hurry or in poor light.

## Product Purpose

GV One HR (the app lives in `nexa/`, repo SounGv/GV-HR) is Gadget Villa's people platform. It covers GPS/QR check-in, shifts and holidays, leave, OT, attendance corrections, employee records and org structure, expense, medical and company-loan requests, payroll, recruitment, assets, KPI/OKR, 360-style evaluation rounds with calibration and 9-box, announcements, notifications through LINE, reports, CSV import and an AI Assistant. Success is HR running attendance, requests and evaluations end to end in one place instead of in spreadsheets and the previous evaluation tool (Favpo).

## Positioning

One system for the whole chain that Gadget Villa's HR team actually runs, in Thai: check-in and shifts feed attendance, leave and OT feed reports and payroll, and notifications reach people through the LINE account they already use. To be confirmed with the owner: what a neighbouring HR product could not truthfully claim.

## Operating Context

- Single real company today ("บริษัท แก็ดเจ็ต วิลล่า จำกัด"), with employee counts that differ between pages because departed staff are counted differently.
- Thai language and Buddhist-era dates for employee-facing screens; Thai labour-law deadlines apply (probation evaluation must finish before day 120).
- Approvals follow the direct manager (`managerId`) with HR-level approvers company-wide.
- The payroll menu is deliberately hidden from the sidebar while HR focuses on attendance, leave and evaluation; payslips are visible only to HR and finance.
- Deployed on Vercel from `main` (gv-hr.vercel.app) with a shared Supabase database.

## Capabilities and Constraints

- Permissions are role-based and checked on pages and APIs. Anything that changes scores, grades, rater weights, scale ranges or pay needs HR (the owner) to confirm first.
- Evaluation results exist in two models: the older review table and the campaign model. Campaign results are the going-forward model.
- The mobile experience is the same Next.js app (installable PWA), with dedicated mobile views for the main employee jobs; there is no native app.
- The database allows one connection per server instance, so queries run one after another.
- Open product decisions: whether evaluation results feed bonus or salary; whether numeric KPIs count inside evaluation scores; how often subordinates rate managers; which working days count when a leave spans a weekend.

## Brand Commitments

- Company name, logo, colours and favicon are meant to come from the company settings page, because the product is intended to be sold to other companies later while staying internal first.
- Gadget Villa's own identity is the GV volt lime (`#CDEB03`) on charcoal (`#131516`) with the supplied transparent logo files. This conflicts with the teal/gold "Flip7" theme the dashboard currently uses (taken from the warehouse team web, at the owner's request). Which one is binding for the whole system is undecided.
- Fonts already loaded in the app: IBM Plex Sans Thai (UI) and Sora (numerals and Latin headings).

## Evidence on Hand

- A live company with real employee, attendance and leave data; no customer testimonials, benchmarks, pricing or licensing material exist, and none should be invented.
- Agreed requirements: `EVALUATION_ATTENDANCE_REQUIREMENTS.md`. Earlier design mock-ups sit in the repo root (`reports-design-mock.html`, `all-pages-design-mock.html`, `evaluation-design-mock.html`) and are proposals, not shipped work.
- Reference for how the previous evaluation tool (Favpo) worked and what GV used from it: the analysis doc "Favpo — วิเคราะห์ระบบประเมินพนักงาน".

## Product Principles

1. HR's desktop workflow comes first; every employee self-service job still has to work in a few taps on a low-end phone.
2. Data should connect: a request, an approval, a notification and a report read the same facts instead of living in separate islands.
3. Pay and score decisions stay with HR: the system shows, never silently changes, anything that affects what a person is paid or rated.
4. Internal first, multi-tenant ready: nothing company-specific is hard-coded where company settings can hold it.

## Accessibility & Inclusion

- Thai is the primary language; long Thai labels must wrap without clipping.
- Used outdoors and in warehouses on mid-range Android phones, sometimes with gloves: large touch targets and status never conveyed by colour alone.
- No formal accessibility standard has been set; WCAG AA contrast is the working baseline.
