# Requirements Document

## Introduction

GradPilot today is heavily oriented toward students applying abroad: GRE/GMAT/IELTS prep, USD-denominated ROI, an NBFC list keyed to US/UK/Canada, a Visa Simulator, and a Currency Risk page. The hackathon problem statement explicitly calls for both international and domestic students, and onboarding already collects a `studyGoal` of `Abroad`, `Domestic (India)`, or `Both`, plus GATE/CAT/NEET status fields, family income, co-applicant, and current CTC.

The Domestic Track MVP turns the existing domestic option into a real path. It introduces six net-new capabilities — a derived `track` flag with a selector hook, an Indian universities dataset, Indian exam inputs in onboarding, a Domestic Admission Predictor, a Domestic Loan Center, and a Central Sector Interest Subsidy (CSIS) eligibility preview — and applies six targeted tweaks to existing modules (sidebar, ROI Calculator, EMI Calculator, SOP Co-Pilot, Scholarship Hunter, Nudge Engine) so they behave correctly when the user is on the domestic track.

The MVP must coexist with the existing abroad flow without regressing it, must persist using existing Supabase `profiles` columns (no schema migration), and must render correctly in both dark and light themes. Out of scope: domestic AI Education Journey phases, JoSAA choice-list optimization, WAT-PI mock interviews, and NEET/CLAT coverage.

## Glossary

- **GradPilot**: The Next.js application that hosts onboarding, the dashboard, and all study-path tools.
- **Track**: A derived enum value with domain `'abroad' | 'domestic' | 'both'` indicating which study paths are active for a user.
- **Track_Selector**: A `useTrack()` React hook that reads the current user's `track` from the Profile_Store and returns it.
- **Study_Goal**: The raw onboarding input with domain `'Abroad' | 'Domestic (India)' | 'Both'` from which `track` is derived.
- **Onboarding**: The existing `OnboardingFlow` multi-step form component.
- **Profile_Store**: The Zustand store in `src/lib/store.ts` that holds `StudentProfile` and syncs to the Supabase `profiles` table.
- **Domestic_Universities_Dataset**: A static array of Indian institute records covering IITs, NITs, IIITs, IIMs, ISB, and BITS, stored in `src/lib/mock-data.ts`.
- **Reservation_Category**: One of `General`, `OBC-NCL`, `EWS`, `SC`, `ST`, `PwD`.
- **Exam_Type**: One of `JEE_Advanced`, `GATE`, `CAT` for the Domestic Track MVP.
- **Closing_Rank**: The last-year final-round closing rank for an (institute, Reservation_Category) tuple.
- **Domestic_Admission_Predictor**: A new page component that classifies institute fits into Reach, Match, or Safety using the user's rank or score and Reservation_Category.
- **Reach_Match_Safety_Bucket**: Output classification with values `Reach`, `Match`, `Safety`, plus `Out_Of_Range` when the user has no eligible exam score.
- **Domestic_Loan_Center**: A new page component listing Indian education-loan products.
- **Premier_Institute_List**: A predefined subset of institute IDs in Domestic_Universities_Dataset eligible for premier-tier loan products such as SBI Scholar Loan.
- **Target_Institute_Id**: The institute id selected by the user inside Domestic_Admission_Predictor and persisted on the profile, consumed by Domestic_Loan_Center and CSIS_Calculator.
- **CSIS_Calculator**: The Central Sector Interest Subsidy preview that determines eligibility and quantifies moratorium-period interest savings.
- **CSIS_Eligibility**: Boolean derived from family income and notified-institute status; eligible when `family_annual_income_inr < 450000` AND `is_notified_for_csis == true`.
- **Notified_Institute**: An institute flagged in Domestic_Universities_Dataset as approved for CSIS subsidy.
- **Dashboard_Sidebar**: The navigation rendered by `DashboardLayout`.
- **ROI_Calculator**: The existing `ROICalculator` page that compares program cost to expected post-graduation earnings.
- **EMI_Calculator**: The existing `EMICalculator` page that estimates loan repayment.
- **SOP_Copilot**: The existing `SOPCopilot` page that drafts statements of purpose.
- **Scholarship_Hunter**: The existing `ScholarshipHunter` page that lists scholarships.
- **Nudge_Engine**: The existing `NudgeEngine` component that surfaces contextual reminders.
- **Visa_Simulator**: The existing abroad-only page at `src/components/pages/VisaSimulator.tsx`.
- **Currency_Risk**: The existing abroad-only page at `src/components/pages/CurrencyRisk.tsx`.
- **formatINR**: The existing utility in `src/lib/utils.ts` that formats integer rupees into Indian-locale strings.

## User Personas

- **Indian Undergrad targeting Domestic PG**: Final-year B.Tech student with a JEE Advanced rank or GATE score, planning M.Tech or MS at an IIT, NIT, or IIIT.
- **Working Professional targeting IIM/ISB**: Two-to-five-year work-experience candidate with a CAT percentile aiming for IIM Ahmedabad, IIM Bangalore, or ISB.
- **Family-Income-Constrained Student**: Domestic applicant from a household with annual income below ₹4.5 lakh who needs CSIS guidance and Vidya Lakshmi portal access to afford a notified institute.

## Requirements

### Requirement 1: Track Field and useTrack Hook

**User Story:** As an Indian student, I want GradPilot to remember whether I am pursuing a domestic, abroad, or combined study path so that every module shows me the right tools without my having to re-state my goal.

#### Acceptance Criteria

1. WHEN Onboarding submits a profile with `Study_Goal == 'Abroad'`, THE Profile_Store SHALL set `track` to `'abroad'`.
2. WHEN Onboarding submits a profile with `Study_Goal == 'Domestic (India)'`, THE Profile_Store SHALL set `track` to `'domestic'`.
3. WHEN Onboarding submits a profile with `Study_Goal == 'Both'`, THE Profile_Store SHALL set `track` to `'both'`.
4. WHEN a component invokes the Track_Selector hook, THE Track_Selector SHALL return the current `track` value held by the Profile_Store.
5. WHEN the Profile_Store hydrates a profile that has `studyGoal` populated but no persisted `track` value, THE Profile_Store SHALL derive `track` from `studyGoal` using the mapping in criteria 1 through 3.
6. WHEN the Profile_Store persists a profile to Supabase, THE Profile_Store SHALL include `track` in the existing JSON-compatible payload using a column already present on the `profiles` table.
7. IF `studyGoal` is missing or empty, THEN THE Profile_Store SHALL set `track` to `'abroad'` and SHALL emit one console warning identifying the missing field.
8. WHERE `studyGoal` has any non-empty string value outside the Study_Goal domain, THE Profile_Store SHALL set `track` to `'abroad'` and SHALL not emit a console warning.

### Requirement 2: Indian Universities Dataset

**User Story:** As a domestic applicant, I want a curated dataset of Indian institutes with seat matrices and category-wise closing ranks so that recommendations and predictions reflect real cutoffs.

#### Acceptance Criteria

1. THE Domestic_Universities_Dataset SHALL contain at least 30 and at most 40 institute records covering IITs, NITs, IIITs, IIMs, ISB, and BITS.
2. THE Domestic_Universities_Dataset SHALL store each record with the fields `id`, `name`, `location`, `examType`, `tuitionINR`, `avgDomesticPlacementCtcINR`, `seatMatrix`, `closingRanks`, and `isNotifiedForCSIS`.
3. THE Domestic_Universities_Dataset SHALL store `examType` as one of `JEE_Advanced`, `GATE`, or `CAT` for every record.
4. THE Domestic_Universities_Dataset SHALL store `closingRanks` as a map from Reservation_Category to a positive integer Closing_Rank for every record whose `examType` is `JEE_Advanced` or `GATE`, and as a map from Reservation_Category to a number in the inclusive range 0 to 100 for every record whose `examType` is `CAT` (representing the closing percentile).
5. THE Domestic_Universities_Dataset SHALL store `tuitionINR` and `avgDomesticPlacementCtcINR` as positive integers in rupees.
6. THE Domestic_Universities_Dataset SHALL store `seatMatrix` as a map from Reservation_Category to a non-negative integer seat count.
7. THE Domestic_Universities_Dataset SHALL include at least one record with `isNotifiedForCSIS == true` and at least one record with `isNotifiedForCSIS == false`.
8. THE Domestic_Universities_Dataset SHALL define `closingRanks` and `seatMatrix` over the same Reservation_Category enum used by Domestic_Admission_Predictor and the Onboarding category input.

### Requirement 3: Indian Exam Inputs in Onboarding

**User Story:** As an Indian applicant, I want to enter my JEE Advanced rank, GATE score and rank, CAT percentile, reservation category, and home state during onboarding so that the platform can personalize predictions and loans.

#### Acceptance Criteria

1. WHILE the user is on Onboarding Step 5, THE Onboarding SHALL present input fields for `jeeAdvancedRank`, `gateScore`, `gateScoreYear`, `gateRank`, `catPercentile`, `reservationCategory`, and `homeState`.
2. WHEN the user submits Onboarding Step 5, THE Onboarding SHALL store the submitted values on the `StudentProfile` type and SHALL include them in the Supabase profile payload.
3. WHERE `track == 'abroad'`, THE Onboarding SHALL hide every Indian-exam input field listed in criterion 1 and SHALL not require values for any of them.
4. WHERE `track == 'domestic'` OR `track == 'both'`, THE Onboarding SHALL display every Indian-exam input field listed in criterion 1.
5. IF `jeeAdvancedRank` or `gateRank` receives a value less than or equal to zero, THEN THE Onboarding SHALL display an inline validation error identifying the offending field and SHALL block submission of the step.
6. IF `catPercentile` receives a value outside the inclusive range 0 to 100, THEN THE Onboarding SHALL display an inline validation error identifying the field and SHALL block submission of the step.
7. IF `gateScoreYear` receives a value outside the inclusive range `currentYear - 4` to `currentYear`, THEN THE Onboarding SHALL display an inline validation error identifying the field and SHALL block submission of the step.
8. WHERE `track == 'domestic'` OR `track == 'both'` AND all of `jeeAdvancedRank`, `gateScore`, and `catPercentile` are blank, THE Onboarding SHALL allow submission of the step and SHALL set `domesticExamScoreMissing == true` on the persisted profile.
9. THE Onboarding SHALL persist `reservationCategory` as one of the six Reservation_Category values when provided and `homeState` as a non-empty string when provided.

### Requirement 4: Domestic Admission Predictor

**User Story:** As a domestic applicant, I want to see Indian institutes classified as Reach, Match, or Safety based on my rank or score and reservation category so that I can target a realistic shortlist.

#### Acceptance Criteria

1. WHEN the user opens Domestic_Admission_Predictor, THE Domestic_Admission_Predictor SHALL read `jeeAdvancedRank`, `gateRank`, `catPercentile`, and `reservationCategory` from the Profile_Store.
2. WHEN classifying a record whose `examType` is `JEE_Advanced`, THE Domestic_Admission_Predictor SHALL use the user's `jeeAdvancedRank`, look up the Closing_Rank for the user's `reservationCategory`, and assign `Safety` when the user's rank is at most 70 percent of the Closing_Rank, `Match` when the user's rank is greater than 70 percent and at most 110 percent of the Closing_Rank, and `Reach` when the user's rank is greater than 110 percent of the Closing_Rank.
3. WHEN classifying a record whose `examType` is `GATE`, THE Domestic_Admission_Predictor SHALL apply the same thresholds defined in criterion 2 using the user's `gateRank`.
4. WHEN classifying a record whose `examType` is `CAT`, THE Domestic_Admission_Predictor SHALL compare the user's `catPercentile` to the record's closing percentile and assign `Safety` when the user's percentile is at least 5 percentile points above the closing percentile, `Match` when the user's percentile is within 5 percentile points of the closing percentile inclusive, and `Reach` when the user's percentile is more than 5 percentile points below the closing percentile.
5. IF the user has no populated score that matches any record's `examType`, THEN THE Domestic_Admission_Predictor SHALL classify every record as `Out_Of_Range` and SHALL display a banner directing the user to update Onboarding Step 5.
6. IF `reservationCategory` is missing, THEN THE Domestic_Admission_Predictor SHALL default lookup to `General` and SHALL display a banner indicating that the user should set a category for accurate results.
7. WHEN Domestic_Admission_Predictor renders results, THE Domestic_Admission_Predictor SHALL group records by Reach_Match_Safety_Bucket and within each bucket SHALL sort records by ascending Closing_Rank for the active Reservation_Category (or by descending closing percentile for `CAT` records).
8. WHEN the user selects a record from the predictor results, THE Domestic_Admission_Predictor SHALL persist that record's `id` to the Profile_Store as `targetInstituteId`.
9. THE Domestic_Admission_Predictor SHALL be implemented as a new page component at `src/components/pages/DomesticAdmissionPredictor.tsx` and SHALL not modify the existing `AdmissionPredictor` page.

### Requirement 5: Domestic Loan Center

**User Story:** As a domestic applicant, I want a dedicated loan center showing Indian education-loan products with eligibility tailored to family income, co-applicant, collateral, premier-institute status, and reservation category so that I can shortlist loans I actually qualify for.

#### Acceptance Criteria

1. THE Domestic_Loan_Center SHALL list at minimum the following products: SBI Scholar Loan, Bank of Baroda Vidya, Canara Vidya Turant, PNB Saraswati, HDFC Credila Domestic, Avanse Domestic, and a Vidya Lakshmi portal entry.
2. WHEN the user opens Domestic_Loan_Center, THE Domestic_Loan_Center SHALL read `familyAnnualIncomeINR`, `coApplicantAvailable`, `collateralAvailable`, `targetInstituteId`, and `reservationCategory` from the Profile_Store.
3. WHEN evaluating a loan product whose definition requires premier-institute status, THE Domestic_Loan_Center SHALL mark the product `Eligible` only if `targetInstituteId` is in the Premier_Institute_List.
4. WHEN evaluating a loan product whose definition requires a co-applicant, THE Domestic_Loan_Center SHALL mark the product `Eligible` only if `coApplicantAvailable == true`.
5. WHEN evaluating a loan product whose definition requires collateral, THE Domestic_Loan_Center SHALL mark the product `Eligible` only if `collateralAvailable == true`.
6. WHEN evaluating a loan product whose definition specifies a family-income ceiling, THE Domestic_Loan_Center SHALL mark the product `Eligible` only if `familyAnnualIncomeINR` is at or below that ceiling.
7. WHEN every required criterion for a loan product is satisfied, THE Domestic_Loan_Center SHALL mark the product `Eligible`.
8. WHEN every input required by a loan product is present AND at least one required criterion evaluates to false, THE Domestic_Loan_Center SHALL mark the product `Not_Eligible`.
9. IF an input required by a loan product is missing AND no other required criterion has already evaluated to false, THEN THE Domestic_Loan_Center SHALL mark the product `Conditionally_Eligible` and SHALL display the missing fields with a deep link to the relevant Onboarding step.
10. THE Domestic_Loan_Center SHALL display every loan product with its eligibility status and a list of matched and unmatched criteria.
11. THE Domestic_Loan_Center SHALL be implemented as a new page component at `src/components/pages/DomesticLoanCenter.tsx` and SHALL not modify the existing `LoanCenter` page.

### Requirement 6: CSIS Eligibility Preview

**User Story:** As a family-income-constrained student, I want to see whether I qualify for the Central Sector Interest Subsidy and how much moratorium-period interest it would save me so that I can plan my financing.

#### Acceptance Criteria

1. WHEN the user opens the CSIS_Calculator, THE CSIS_Calculator SHALL read `familyAnnualIncomeINR` from the Profile_Store and SHALL read `isNotifiedForCSIS` from the Domestic_Universities_Dataset record whose `id` equals `targetInstituteId`.
2. THE CSIS_Calculator SHALL set `csisEligible == true` if and only if `familyAnnualIncomeINR < 450000` AND `isNotifiedForCSIS == true`.
3. WHEN `csisEligible == true`, THE CSIS_Calculator SHALL compute `moratoriumInterestSavedINR` as the simple-interest amount on the user-entered loan principal at the user-entered annual interest rate over the user-entered moratorium period in months.
4. WHEN `csisEligible == false`, THE CSIS_Calculator SHALL set `moratoriumInterestSavedINR` to `0` and SHALL display the specific failing condition (income above threshold, institute not notified, or both).
5. THE CSIS_Calculator SHALL render every monetary output using `formatINR`.
6. IF `familyAnnualIncomeINR` is missing, THEN THE CSIS_Calculator SHALL set `csisEligible == false`, SHALL display an explanatory banner, and SHALL provide a deep link to Onboarding Step 7.
7. IF `targetInstituteId` is missing, THEN THE CSIS_Calculator SHALL set `csisEligible == false`, SHALL display an explanatory banner, and SHALL provide a deep link to Domestic_Admission_Predictor.
8. WHERE the loan principal, annual interest rate, or moratorium months input is non-numeric or negative, THE CSIS_Calculator SHALL display an inline validation error and SHALL not produce a savings value.
9. WHERE the loan principal, annual interest rate, or moratorium months input is numeric and equal to zero, THE CSIS_Calculator SHALL accept the input and SHALL compute `moratoriumInterestSavedINR` as `0`.

### Requirement 7: Dashboard Sidebar Track-Aware Navigation

**User Story:** As a domestic-only user, I want abroad-only modules hidden and domestic modules shown so that the dashboard reflects my study path.

#### Acceptance Criteria

1. WHILE `track == 'domestic'`, THE Dashboard_Sidebar SHALL hide the Visa_Simulator (`visa-simulator`) and Currency_Risk (`currency-risk`) navigation items.
2. WHILE `track == 'domestic'` OR `track == 'both'`, THE Dashboard_Sidebar SHALL display navigation items for Domestic_Admission_Predictor and Domestic_Loan_Center.
3. WHILE `track == 'abroad'`, THE Dashboard_Sidebar SHALL display Visa_Simulator and Currency_Risk and SHALL hide Domestic_Admission_Predictor and Domestic_Loan_Center.
4. WHILE `track == 'both'`, THE Dashboard_Sidebar SHALL display Visa_Simulator, Currency_Risk, Domestic_Admission_Predictor, and Domestic_Loan_Center concurrently.
5. WHEN the Profile_Store value of `track` changes, THE Dashboard_Sidebar SHALL re-render with the navigation set that matches the new `track` without requiring a page reload.

### Requirement 8: ROI Calculator INR Mode

**User Story:** As a domestic applicant, I want the ROI Calculator to compute return on investment in rupees and lakhs so that the numbers are familiar and comparable to Indian salary norms.

#### Acceptance Criteria

1. WHILE `track == 'domestic'`, THE ROI_Calculator SHALL accept and display CTC and cost inputs in INR with a "lakhs" unit toggle and SHALL display every monetary output using `formatINR`.
2. WHILE `track == 'abroad'`, THE ROI_Calculator SHALL retain its existing USD behavior unchanged.
3. WHILE `track == 'both'`, THE ROI_Calculator SHALL expose a currency switch defaulting to INR and SHALL allow the user to switch to USD for comparison.
4. WHEN the user changes the currency switch, THE ROI_Calculator SHALL recompute outputs using the selected currency without losing previously entered numeric inputs.
5. IF a CTC or cost input is non-numeric or negative, THEN THE ROI_Calculator SHALL display an inline validation error and SHALL not produce a derived ROI value.

### Requirement 9: EMI Calculator Domestic Presets and CSIS Toggle

**User Story:** As a domestic applicant, I want the EMI Calculator to default to Indian interest ranges and let me toggle CSIS so that I can see the effective EMI both with and without subsidy.

#### Acceptance Criteria

1. WHILE `track == 'domestic'` OR `track == 'both'`, THE EMI_Calculator SHALL default the annual interest rate slider to a range of 8.5 percent to 12.0 percent inclusive.
2. WHILE `track == 'domestic'` OR `track == 'both'`, THE EMI_Calculator SHALL display a CSIS toggle.
3. WHEN the CSIS toggle is enabled AND CSIS_Eligibility evaluates to `true`, THE EMI_Calculator SHALL recompute the effective EMI by excluding the moratorium-period interest from the principal-plus-interest base.
4. WHEN the CSIS toggle is enabled AND CSIS_Eligibility evaluates to `false`, THE EMI_Calculator SHALL leave the EMI unchanged and SHALL display a banner identifying the failing eligibility condition.
5. WHILE `track == 'abroad'`, THE EMI_Calculator SHALL retain its existing default interest range and SHALL hide the CSIS toggle.
6. WHILE the active currency mode is INR, THE EMI_Calculator SHALL render every monetary output using `formatINR`.

### Requirement 10: SOP Co-Pilot Relabel for Domestic Use

**User Story:** As a domestic applicant preparing an IIT M.Tech statement of purpose or IIM WAT-PI essay, I want the SOP Co-Pilot label and examples to reflect both abroad SOPs and domestic SOP-style notes so that the tool feels relevant.

#### Acceptance Criteria

1. THE SOP_Copilot SHALL display its title and primary call-to-action as "SOP / SOP-style note" for every value of `track`.
2. THE SOP_Copilot SHALL retain its existing prompt-construction and AI-call logic without functional change.
3. WHILE `track == 'domestic'`, THE SOP_Copilot SHALL display only the domestic example list, which SHALL include at least one example labeled as an IIT M.Tech research statement and at least one example labeled as an IIM WAT-PI style note.
4. WHILE `track == 'abroad'`, THE SOP_Copilot SHALL display its existing abroad example list unchanged and SHALL not include any domestic example.
5. WHILE `track == 'both'`, THE SOP_Copilot SHALL display the union of the abroad and domestic example lists.

### Requirement 11: Scholarship Hunter Indian Scholarships

**User Story:** As a domestic applicant, I want Indian scholarships listed alongside abroad scholarships so that I can apply to opportunities relevant to my study path.

#### Acceptance Criteria

1. THE Scholarship_Hunter dataset SHALL include at least 8 and at most 10 Indian scholarship records, including INSPIRE Scholarship, INSPIRE-MANAK, Reliance Foundation Undergraduate Scholarship, at least one state-level merit scholarship, and a Tata Trust scholarship.
2. THE Scholarship_Hunter SHALL store every Indian scholarship record with `currency == 'INR'` and a numeric `amount` in rupees, and SHALL exclude from the Indian-scholarship list any record that lacks an INR amount.
3. WHILE `track == 'domestic'`, THE Scholarship_Hunter SHALL display only scholarships whose `currency == 'INR'` by default.
4. WHILE `track == 'abroad'`, THE Scholarship_Hunter SHALL display only scholarships whose `currency != 'INR'` by default.
5. WHILE `track == 'both'`, THE Scholarship_Hunter SHALL display every scholarship and SHALL sort the default list by ascending deadline.
6. WHEN the user applies an explicit currency filter, THE Scholarship_Hunter SHALL respect the filter for every value of `track`.

### Requirement 12: Nudge Engine Domestic Nudges

**User Story:** As a domestic applicant, I want timely nudges about CSIS eligibility, JoSAA round dates, and GATE score validity so that I do not miss critical deadlines or overlooked benefits.

#### Acceptance Criteria

1. WHILE `track == 'domestic'` OR `track == 'both'`, THE Nudge_Engine SHALL evaluate a CSIS eligibility nudge that fires when CSIS_Eligibility evaluates to `true` AND the user has not yet acknowledged that nudge.
2. WHILE `track == 'domestic'` OR `track == 'both'`, THE Nudge_Engine SHALL evaluate a JoSAA round dates nudge that fires when the current date is within 14 days before any configured JoSAA round date.
3. WHILE `track == 'domestic'` OR `track == 'both'`, THE Nudge_Engine SHALL evaluate a GATE score validity nudge that fires when `currentYear - gateScoreYear >= 2` AND `currentYear - gateScoreYear <= 3`.
4. WHEN the Nudge_Engine surfaces a domestic nudge, THE Nudge_Engine SHALL include the nudge type and the triggering condition, and SHALL include a deep link to the relevant module (CSIS_Calculator, Domestic_Admission_Predictor, or Onboarding Step 5) when one is available.
5. WHILE `track == 'abroad'`, THE Nudge_Engine SHALL not surface any domestic nudge defined in criteria 1 through 3.
6. IF a domestic nudge has been dismissed by the user, THEN THE Nudge_Engine SHALL not re-surface that exact nudge for at least 7 days.

## Non-Functional Requirements

### Requirement 13: No Regression of Abroad Flow

**User Story:** As an abroad-track user, I want the existing abroad experience untouched so that introducing the domestic track does not break my workflow.

#### Acceptance Criteria

1. WHILE `track == 'abroad'`, THE GradPilot SHALL render every existing abroad page with behavior identical to the pre-MVP baseline.
2. WHEN any new domestic component is mounted, THE GradPilot SHALL not mutate state owned exclusively by an abroad-only component.

### Requirement 14: Persistence Without Schema Migration

**User Story:** As a maintainer, I want every new domestic field to persist using existing Supabase columns so that I can ship this MVP without coordinating a database migration.

#### Acceptance Criteria

1. THE Profile_Store SHALL persist every new domestic field (`track`, `jeeAdvancedRank`, `gateScore`, `gateScoreYear`, `gateRank`, `catPercentile`, `reservationCategory`, `homeState`, `targetInstituteId`, `domesticExamScoreMissing`) using existing JSON-compatible columns on the Supabase `profiles` table.
2. THE Profile_Store SHALL not require a Supabase schema migration to deploy this MVP.
3. IF a Supabase row is missing any new domestic field, THEN THE Profile_Store SHALL treat the field as `undefined` and SHALL apply the defaults defined in Requirements 1, 3, and 4.

### Requirement 15: Theme Compatibility

**User Story:** As a user, I want the new domestic surfaces to look correct in both dark and light themes so that visual consistency is preserved.

#### Acceptance Criteria

1. WHILE the application is in dark theme, THE GradPilot SHALL render every new domestic page, every modified sidebar item, and the CSIS_Calculator using existing dark-theme tokens with no hard-coded light-only colors.
2. WHILE the application is in light theme, THE GradPilot SHALL render the same components using existing light-theme tokens with no hard-coded dark-only colors.

### Requirement 16: Module Isolation

**User Story:** As a maintainer, I want the domestic predictor and loan center to live in separate files so that abroad logic remains clean and the diff stays reviewable.

#### Acceptance Criteria

1. THE Domestic_Admission_Predictor SHALL live at `src/components/pages/DomesticAdmissionPredictor.tsx` and SHALL not modify `src/components/pages/AdmissionPredictor.tsx`.
2. THE Domestic_Loan_Center SHALL live at `src/components/pages/DomesticLoanCenter.tsx` and SHALL not modify `src/components/pages/LoanCenter.tsx`.
3. THE Track_Selector SHALL live at `src/lib/useTrack.ts` and SHALL be the single source of truth for `track` reads in the application.

### Requirement 17: Next.js 16.2.4 Compliance

**User Story:** As a maintainer, I want every new route and page to follow the Next.js 16.2.4 conventions bundled with this repo so that the build does not regress and deprecation warnings stay clean.

#### Acceptance Criteria

1. THE GradPilot SHALL implement every new page and route using the Next.js 16.2.4 App Router conventions documented in `node_modules/next/dist/docs/`.
2. THE GradPilot SHALL not introduce any Next.js API flagged as deprecated in the bundled documentation.

## Out of Scope

1. Domestic phases for the AI Education Journey decision engine.
2. JoSAA choice-list optimizer or counseling co-pilot.
3. WAT-PI mock interview tooling.
4. NEET PG/UG and CLAT coverage.
5. New Supabase columns or tables beyond reuse of existing JSON-compatible columns on `profiles`.
