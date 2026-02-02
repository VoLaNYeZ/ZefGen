# /specs
# Start from user's initial plan -> guided interview -> generates spec pack into docs/

## Goal
Turn the user's initial idea/plan into an executable spec pack with minimal guessing.
Actively push for clarity on scope, UX/system boundaries, and acceptance criteria.
Then write the spec pack into docs/ so implementation can proceed with minimal back-and-forth.

## Inputs (from the user, in chat)
The user must provide an initial plan/idea in their message.
If it is missing or too vague, ask for it first before anything else.

## Outputs (always write/update these)
- .agent/execplans/master.md
- docs/spec/00_source/initial_brief.md
- docs/spec/01_prd.md
- docs/spec/02_system_map.md
- docs/spec/02_ui_map.md (only if UI exists)
- docs/spec/03_open_questions.md
- docs/spec/04_acceptance_tests.md
- docs/spec/05_milestones.md

Do NOT require a pre-existing client spec file.
If any additional info is provided during the interview, append it to initial_brief.md as "Notes".

## Requirements discipline
- Use stable requirement IDs: R001, R002, ...
- If something is unclear, write an Open Question instead of inventing behavior.
- Keep outputs concise and stable (prefer updating sections, not rewriting everything).

## ExecPlan requirement
After generating docs/spec/*, always generate/update:
- .agent/execplans/master.md
Follow the template and rules in .agent/PLANS.md.
Do not start implementation inside /specs.


## Workflow

### Step 0 - Capture the initial brief
1) Ask the user for a short initial plan if not provided:
   - What are you building? (1 sentence)
   - Who is it for? (1 sentence)
   - What are the top 3 must-have features?
   - What is out of scope for v1?
   - Any deadline/platform constraints?
2) Write the user's input verbatim into:
   - docs/spec/00_source/initial_brief.md

### Step 1 - Push for clarity (guided interview)
Ask one question at a time. Each question:
- has 2-4 options
- each option includes a short tradeoff
- includes a recommendation when possible
Wait for the user's answer before moving on.

#### Q1 - Project type
Header: Type
Question: What are we building?
A) User-facing app/product
B) Backend/API/service
C) Extension/plugin/integration
D) Library/SDK/tooling
Recommended: pick the closest match.

#### Q2 - Platforms/runtime
Header: Target
Question: Where must it run?
A) Web
B) Mobile
C) Desktop
D) Server/Cloud
Recommended: the platform that drives UX + deployment.

#### Q3 - UI surface
Header: UI
Question: Do we have a UI?
A) No UI (CLI/service only)
B) Minimal UI (admin/settings only)
C) Full UI (primary product surface)
Recommended: choose honestly (affects UI_MAP).

#### Q4 - Core outcome
Header: Outcome
Question: After a user uses v1, what must be true?
A) They completed a workflow (create/edit/export/etc.)
B) They got an answer/insight (search, recommendation, summary)
C) The system automated a task (sync, ingest, monitor)
Recommended: the one you would measure success by.

#### Q5 - Data model (minimum)
Header: Data
Question: What are the 1-3 core entities?
A) I can list them now
B) I have a rough idea, need help defining
C) Not sure yet
Recommended: A or B. If B/C, propose a simple default entity model and confirm.

#### Q6 - Storage & sync
Header: Store
Question: Storage expectation?
A) Local only
B) Cloud (accounts + backend)
C) Hybrid (local cache + cloud)
Recommended: A for fastest MVP unless cloud is required.

#### Q7 - Auth & roles
Header: Auth
Question: Accounts/roles?
A) No auth
B) Simple auth
C) Roles/permissions
Recommended: A unless explicitly required.

#### Q8 - Integrations
Header: Integr
Question: Required integrations?
A) None
B) 1-2 external services
C) Many integrations
Recommended: keep it minimal for v1.

#### Q9 - Non-functional priority
Header: NFR
Question: What do we optimize for in v1?
A) Speed of delivery
B) Security/compliance
C) Performance/scale
D) Maintainability (long-term)
Recommended: A unless client constraints demand otherwise.

#### Q10 - MVP boundaries
Header: MVP
Question: Which approach for v1 scope?
A) Minimal MVP (smallest usable thing)
B) Feature-complete spec v1
C) Prototype only
Recommended: A.

#### Q11 - Acceptance criteria
Header: Done
Question: How do you want "done" defined?
A) Demo-ready (happy path)
B) Production-ready (errors, edge cases, basic tests)
C) Store-ready / launch-ready (polish + analytics + compliance)
Recommended: B for most paid client work.

### Step 2 - Generate spec pack (write files)
Using the initial brief + interview answers:

#### docs/spec/01_prd.md
Must include:
- Summary (1-2 paragraphs)
- In-scope vs out-of-scope for v1
- Requirements list with IDs (R001...)
- Each requirement: behavior + states (empty/loading/error) if relevant
- Acceptance criteria checklist (v1)

#### docs/spec/02_system_map.md
Must include:
- Components (UI/API/DB/integrations) depending on answers
- Entities (high-level)
- Key flows
- Constraints + assumptions

#### docs/spec/02_ui_map.md (only if UI exists)
Must include:
- Screen list grouped by flows/sections
- Navigation transitions A -> B (condition)
- Modals/sheets
- Empty/loading/error states per major screen

#### docs/spec/03_open_questions.md
Must include:
- Remaining unknowns (Q1..Qn)
- Why it matters
- Proposed default (optional)

#### docs/spec/04_acceptance_tests.md
Must include:
- Scenario tests (Given/When/Then)
- Smoke tests for v1
- Key NFR checks (based on Q9)

#### docs/spec/05_milestones.md
Must include:
- Milestones M1..Mn
- Each milestone lists the requirement IDs it covers
- Verification strategy (how we validate each milestone)

### Step 2.5 - Generate ExecPlan (master)
Create or update:
- .agent/execplans/master.md

It MUST follow .agent/PLANS.md and include:
- Purpose
- Constraints
- Milestones M1..Mn
- Each milestone references PRD requirement IDs (R001...)
- Progress checklist
- Decision Log
- Verification commands (project-appropriate)

### Step 3 - Next step suggestion
After generating the docs:
- ask the user to approve the milestone plan
- then propose starting M1 only (smallest deliverable)
