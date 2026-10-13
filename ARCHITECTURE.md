# Architecture — AI Playwright Framework

## Overview

An AI-powered E2E test automation framework built on Playwright + JavaScript.
Engineers write plain-English instruction files. The AI reads them and generates
all Page Objects and test specs. Test failures are automatically analysed and raised
as bug tickets in Jira — no manual coding required at any stage.

**Application under test:** QA Demo Portal (local dummy application)
- Admin Portal: http://127.0.0.1:3100
- Test Web Portal: http://127.0.0.1:3000
**Jira project:** https://md-salekin-newaz.atlassian.net/jira/core/projects/TP/board

---

## Project Structure

```
ai-playwright-framework/
│
├── .context/                            ← Universal AI knowledge base (LLM-agnostic)
│   ├── global/
│   │   └── global-context.md            App info, selector rules, coding conventions
│   ├── instructions/
│   │   ├── pages/                       One .md per page — elements, actions, behaviours
│   │   │   ├── admin-dashboard-page.md
│   │   │   ├── admin-login-page.md
│   │   │   ├── admin-responsibility-map-page.md
│   │   │   ├── admin-smtp-page.md
│   │   │   ├── testweb-forgot-password-page.md
│   │   │   ├── testweb-home-page.md
│   │   │   ├── testweb-installation-system-page.md
│   │   │   ├── testweb-login-page.md
│   │   │   ├── testweb-machine-configuration-page.md
│   │   │   └── testweb-register-page.md
│   │   └── features/                    One .md per test flow — scenarios, test data
│   │       ├── admin-login-flow.md
│   │       ├── admin-dashboard-flow.md
│   │       ├── admin-smtp-flow.md
│   │       ├── admin-responsibility-map-flow.md
│   │       ├── testweb-login-flow.md
│   │       ├── testweb-installation-system-flow.md
│   │       ├── testweb-machine-configuration-flow.md
│   │       ├── testweb-register-flow.md
│   │       ├── auth-session-management.md
│   │       ├── role-based-access-control.md
│   │       └── ...
│   ├── prompts/                         System prompts guiding AI output
│   │   ├── pom-generator.md
│   │   ├── test-generator.md
│   │   └── failure-analyzer.md
│   └── skills/                          Consolidated LLM-agnostic skill definitions
│       ├── framework-architecture.md    Full architecture, POM rules, generation workflow
│       ├── automation-rules.md          Pre-automation checklist, file creation order
│       └── pr-description.md            PR description format
│
├── src/pages/                           ← Page Object Models (AI-generated)
│   ├── base/
│   │   └── BasePage.js                  Base class — navigate, waitForLoad, getURL
│   ├── admin/
│   │   ├── AdminLoginPage.js            Admin portal login elements + actions
│   │   ├── AdminDashboardPage.js        Admin dashboard + route navigation
│   │   ├── AdminResponsibilityMapPage.js Responsibility map dataset page
│   │   └── AdminSmtpPage.js             SMTP settings page
│   └── testweb/
│       ├── TestWebLoginPage.js          Test web portal login elements + actions
│       ├── TestWebHomePage.js           Test web landing page elements
│       ├── TestWebInstallationSystemPage.js Installation system page elements
│       ├── TestWebMachineConfigurationPage.js Machine config panel elements
│       ├── TestWebRegisterPage.js       Registration page elements
│       └── TestWebForgotPasswordPage.js Forgot password page elements
│
├── tests/                               ← Test specs (AI-generated)
│   ├── fixtures/
│   │   ├── base.fixture.js              Fresh browser — for unauthenticated tests
│   │   ├── admin-auth.fixture.js        Pre-logged-in as admin@penn.com
│   │   ├── web-customer-auth.fixture.js Pre-logged-in as customer@penn.com
│   │   ├── web-distributor-auth.fixture.js Pre-logged-in as distributor@penn.com
│   │   ├── web-engineer-auth.fixture.js Pre-logged-in as engineering@penn.com
│   │   ├── web-sales-auth.fixture.js    Pre-logged-in as sales@penn.com
│   │   ├── data-helper.js               Test user loader with caching
│   │   ├── expect-helper.js             assertThat wrapper for readable failures
│   │   └── step-runner.js               Step wrapper with console logging + timing
│   ├── admin-login/
│   │   ├── admin-login.spec.js          TC-ADM-LOGIN-01 & 02 (happy path + invalid)
│   │   └── auth-session-management.spec.js TC-AUTH-06,08,09,10,11 (session tests)
│   ├── admin-dashboard/
│   ├── admin-datasets/
│   ├── admin-email-notifications/
│   ├── admin-pages/
│   ├── admin-portal/
│   ├── admin-responsibility-mapping/
│   ├── admin-settings/
│   ├── admin-sidebar-navigation/
│   ├── cross-cutting-edge-cases/
│   ├── e2e-flows/
│   ├── installation-system/
│   ├── machine-configuration/
│   ├── role-based-access-control/
│   ├── testweb-forgot-password/
│   ├── testweb-home/
│   ├── testweb-login/
│   ├── testweb-register/
│   └── testweb-role-based-access-control/
│
├── scripts/
│   ├── gen-pom.js                       Bulk generate Page Objects from instruction files
│   ├── gen-tests.js                     Bulk generate test specs from instruction files
│   ├── analyze-failures.js              AI analysis of test failures
│   ├── analyze-and-report.js            Bug analyzer + Jira ticket creator
│   ├── generate-fancy-report.js         Custom HTML report generator
│   ├── run-group.js                     Run tests by sheet group
│   ├── sync-bugs-to-sheet.js            Sync bugs to Google Sheet
│   ├── sync-test-cases-to-sheet.js      Sync test cases to Google Sheet
│   ├── update-sheet-results.js          Update sheet with last run results
│   ├── check-health.js                  Health check for dummy app
│   ├── lib/
│   │   ├── instructions.js              Parse instruction files
│   │   ├── generate-pom.js              POM generation logic
│   │   ├── generate-tests.js            Test generation logic
│   │   ├── mappings.js                  Feature-to-page mappings
│   │   ├── templates.js                 Code templates
│   │   ├── llm.js                       LLM client (Anthropic)
│   │   └── analyze-failures.js          Failure analysis logic
│   └── test-groups.json                 Maps groups to spec globs + grep filters
│
├── test-data/
│   └── users.json                       Test credentials (single source of truth)
│
├── dummy-app/                           ← Local QA Demo Portal (zero-dependency)
│   ├── server.js                        Node.js HTTP server (two origins)
│   ├── lib/
│   │   ├── api.js                       JSON API handlers
│   │   ├── http.js                      HTTP helpers (cookies, static files)
│   │   └── store.js                     In-memory data store (session-isolated)
│   └── public/
│       ├── admin.js                     Admin portal SPA client
│       ├── testweb.js                   TestWeb portal SPA client
│       ├── base.css                     Shared styles
│       └── vendor-lite.js               DOM/API helpers (no framework runtime)
│
├── .mcp.json                            Jira MCP server config (gitignored)
├── .claude/settings.json                Auto-approves MCP servers for this project
├── .env                                 API keys — AI provider + Jira (gitignored)
├── playwright.config.js                 Playwright + Allure reporter config
├── AGENTS.md                            ← Universal LLM entry point (Cline, Roo, etc.)
├── .cursorrules                         ← Cursor editor config
├── .github/copilot-instructions.md      ← GitHub Copilot config
├── opencode.json                        ← OpenCode config
└── package.json                         NPM scripts
```

---

## Full Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│  FLOW 1 — Adding a New Test Case                                │
└─────────────────────────────────────────────────────────────────┘

  Jira Ticket (TP project)
        │  requirement described in plain English
        ▼
  AI reads the ticket via Jira MCP
        │
        ▼
  Engineer creates instruction files:
    .context/instructions/pages/my-page.md       ← UI elements + selectors
    .context/instructions/features/my-flow.md    ← Test scenarios + steps
        │
        │  "generate"
        ▼
  AI reads .md files + global-context.md
        │
        ├──▶  src/pages/MyPage.js                    Page Object generated
        └──▶  tests/my-flow/my-flow.spec.js           Test spec generated
        │
        │  npm test
        ▼
  Playwright executes tests (Chromium / Firefox / WebKit)
        │
        ├──▶  PASS → Allure Report
        └──▶  FAIL → Flow 2


┌─────────────────────────────────────────────────────────────────┐
│  FLOW 2 — Failure Analysis + Jira Bug Reporting                 │
└─────────────────────────────────────────────────────────────────┘

  Test fails
        │  Playwright writes reports/last-run.json
        ▼
  npm run report:bugs
        │
        ▼
  scripts/analyze-and-report.js
        │
        ├── Reads each failed test from report
        │
        ├── Classifies root cause:
        │     selector  → element not found / selector changed
        │     timing    → timeout exceeded
        │     navigation → redirect did not occur
        │     assertion → text / URL mismatch
        │
        ├── Determines priority by keyword match:
        │     P1 Highest → login, checkout, auth, order, payment
        │     P2 High    → cart, form, submit, navigation, redirect
        │     P3 Medium  → sort, filter, text, UI, badge
        │
        ├── AI (if ANTHROPIC_API_KEY set):
        │     reads .context/prompts/failure-analyzer.md
        │     produces richer root cause + suggested fix
        │
        └── Creates Jira Task via REST API:
              Summary:     [Bug] Suite › Test name
              Priority:    Highest / High / Medium
              Labels:      automated-bug, playwright, e2e, p1/p2/p3
              Description: Error · Root Cause · Suggested Fix · Stack Trace
```

---

## Architecture Diagram

```mermaid
flowchart TD
    %% Requirements & Context
    RC[Requirements & Context\n.context/instructions/\n.pages/ + .features/]
    GC[Global Context\n.context/global/global-context.md]
    SP[System Prompts\n.context/prompts/]
    
    %% AI Generation
    AI[AI Generation Engine\n(gen-pom.js / gen-tests.js)]
    
    %% Generated Artifacts
    POM[Page Objects\nsrc/pages/\nBasePage + Admin* + TestWeb*]
    SPEC[Test Specs\ntests/\n*.spec.js]
    
    %% Test Fixtures
    FIX[Fixtures\ntests/fixtures/\nauth, data, step, expect helpers]
    
    %% Playwright Execution
    PW[Playwright Test Runner\nplaywright.config.js\nwebServer: dummy-app]
    
    %% Dummy Application
    DA[Dummy Application\ndummy-app/\nserver.js + SPA clients]
    ADM[Admin Portal\n:3100\nLogin, Dashboard,\nDatasets, Users, SMTP]
    TWP[TestWeb Portal\n:3000\nInstallation System,\nMachine Config, RFQ]
    
    %% Reports & Integrations
    HTML[HTML Report\nreports/playwright-report/]
    ALLURE[Allure Report\nallure-results/ → allure-report/]
    JSON[JSON Results\nreports/last-run.json]
    FAIL[Failure Analysis\nanalyze-failures.js]
    JIRA[Jira Bug Creation\nanalyze-and-report.js]
    GS[Google Sheets Sync\nupdate-sheet-results.js]
    
    %% Flow
    RC --> AI
    GC --> AI
    SP --> AI
    AI --> POM
    AI --> SPEC
    POM --> PW
    SPEC --> PW
    FIX --> PW
    PW --> DA
    DA --> ADM
    DA --> TWP
    PW --> HTML
    PW --> ALLURE
    PW --> JSON
    JSON --> FAIL
    FAIL --> JIRA
    JSON --> GS
    
    %% Styling
    classDef gen fill:#e1f5fe,stroke:#01579b
    classDef exec fill:#fff3e0,stroke:#e65100
    classDef app fill:#f3e5f5,stroke:#4a148c
    classDef rep fill:#e8f5e9,stroke:#1b5e20
    
    class POM,SPEC gen
    class PW,DA,ADM,TWP exec
    class FIX exec
    class HTML,ALLURE,JSON,FAIL,JIRA,GS rep
```

---

## Architecture Decisions

### ADR-001 · Page Object Model
All page interactions are encapsulated in POM classes under `src/pages/`.
Every POM extends `BasePage`. Tests never reference selectors directly.

### ADR-002 · LLM-Agnostic Knowledge Base (`.context/` is the Single Source of Truth)
All project knowledge, skill definitions, and instructions live in `.context/` as plain `.md` files.
This is LLM-agnostic — works with Claude Code, Cursor, GitHub Copilot, Windsurf, OpenCode, Cline, and any other AI coding agent.
Each LLM has its own entry-point config (`.claude/`, `.cursorrules`, `.github/copilot-instructions.md`, `AGENTS.md`, `opencode.json`)
but they all reference the same `.context/` knowledge base — no duplication, no drift.

### ADR-003 · Markdown Instruction Files
`.md` files in `.context/instructions/` are the single source of truth for generation.
Consistent instruction format → consistent AI output quality.
Page instructions describe UI. Feature instructions describe test scenarios.

### ADR-004 · Jira MCP Integration
Claude Code connects to Jira via `.mcp.json` (`mcp-jira-cloud` server).
Enables reading ticket requirements directly and creating bug reports automatically.
Credentials stored in `.env` and `.mcp.json` (both gitignored).

### ADR-005 · Fixture-First Test Architecture
All tests import from `tests/fixtures/` — never from `@playwright/test` directly.
`base.fixture.js` → unauthenticated tests (login).
Role-specific auth fixtures → pre-logged-in tests for each user role.

### ADR-006 · Allure Reporting
Allure reporter runs alongside Playwright's built-in HTML and JSON reporters.
Raw results → `allure-results/`. HTML report → `allure-report/`.

### ADR-007 · Automated Bug Reporting
On test failure, `scripts/analyze-and-report.js` reads the Playwright JSON report,
classifies each failure by root cause and priority, then creates a Jira ticket
automatically — closing the loop between test execution and bug tracking.

### ADR-008 · Local Dummy Application with Session Isolation
The framework includes a self-contained Node.js HTTP server (`dummy-app/`) that runs
both portals in a single process. Each browser session gets isolated application state
via session-specific storage (`sessionApplications` Map), preventing test interference
in parallel execution. No external dependencies, paid APIs, or network access required.

---

## NPM Scripts

| Command | Description |
|---|---|
| `npm test` | Run all tests headless |
| `npm run test:headed` | Run with browser visible |
| `npm run test:ui` | Playwright interactive UI mode |
| `npm run test:debug` | Playwright debug mode |
| `npm run gen:pom` | Generate Page Objects from instruction files |
| `npm run gen:tests` | Generate test specs from instruction files |
| `npm run generate` | Generate all POMs + test specs |
| `npm run test:report-bugs` | Run tests + auto-create Jira bugs on failure |
| `npm run report:bugs` | Analyse last run + create Jira bugs |
| `npm run allure:serve` | Generate + open Allure report |
| `npm run allure:generate` | Build Allure HTML report |
| `npm run allure:open` | Open already-built Allure report |
| `npm run report` | Open Playwright HTML report |
| `npm run report:fancy` | Generate custom HTML report from last run |
| `npm run full` | Generate everything + run all tests |
| `npm run app:start` | Start dummy app manually |
| `npm run app:health` | Check dummy app health endpoints |
| `npm run sync:results` | Update Google Sheet with last run results |
| `npm run sync:all` | Sync test cases, bugs, and results to Google Sheet |
| `npm run test:group -- "Group"` | Run tests by sheet group |

---

## How to Add a New Test Case

1. Read or create a Jira ticket describing the requirement
2. Create `.context/instructions/pages/my-page.md` (elements, selectors, actions)
3. Create `.context/instructions/features/my-flow.md` (test scenarios, fixture, test data)
4. Update `FEATURE_PAGES_MAP` in `scripts/gen-tests.js` to map the feature to its page objects
5. Tell the AI: **"generate"** — or run `npm run generate`
6. AI writes `src/pages/MyPage.js` and `tests/my-flow/my-flow.spec.js`
7. Run `npm test` — or `npm run test:report-bugs` to auto-file bugs on failure

---

## How to Fix a Failing Test

1. Run `npm run report:bugs` — Jira ticket created automatically
2. Read the ticket: error + root cause + suggested fix are pre-filled
3. If selector changed → update the relevant `.md` instruction file → regenerate
4. If logic changed → tell the AI the updated requirement → regenerate
5. Re-run `npm test` to confirm the fix

---

## Tech Stack

| Tool | Version | Role |
|---|---|---|
| Playwright | ^1.44.0 | Browser automation + test runner |
| Node.js | 18+ | Runtime |
| AI Agent | any | Code generation + analysis (Claude, Copilot, Cursor, etc.) |
| Allure | ^2.38.1 | Test reporting |
| mcp-jira-cloud | latest | Jira integration via MCP |
| Anthropic SDK | ^0.24.0 | Claude API (optional, for richer analysis) |
| dotenv | ^16.4.5 | Environment config |

---

## Environment Configuration

| Variable | Default | Description |
|---|---|---|
| `ADMIN_PORT` / `TESTWEB_PORT` | `3100` / `3000` | Ports the demo app binds |
| `ADMIN_BASE_URL` / `TESTWEB_BASE_URL` | `http://127.0.0.1:3100` / `http://127.0.0.1:3000` | Origins the tests navigate to |
| `BASE_URL` | `ADMIN_BASE_URL` | Playwright baseURL shortcut |
| `ANTHROPIC_API_KEY` | — | Required for AI generation (`--ai` flag) |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | — | Path to service account JSON for Sheets |
| `JIRA_URL` / `JIRA_EMAIL` / `JIRA_API_TOKEN` | — | Required for Jira integration |

See `.env.example` for all placeholders.

---

## Application Lifecycle

```
npm test
    │
    ▼
Playwright webServer starts dummy-app/server.js --portal=testweb (port 3000)
Playwright webServer starts dummy-app/server.js --portal=admin (port 3100)
    │
    ▼
Health checks: GET /health on both ports (60s timeout)
    │
    ▼
Tests execute against local origins
    │
    ▼
Playwright shuts down webServer processes on completion
```

- `reuseExistingServer: !process.env.CI` — reuses running servers in local dev, fresh in CI
- Session isolation via `qademo_session` cookie + `sessionApplications` Map
- Zero external dependencies — runs fully offline