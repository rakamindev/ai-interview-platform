# frozen_string_literal: true

# Seeds for local development, multi-tenant verification, and end-to-end feature demos.
# Resets all data cleanly and seeds 2 isolated tenant accounts with rich example data
# across every feature (Assessments, Sessions, Transcripts, Coverage Maps, Portfolios,
# Discovered Skills, Assessor Overrides, Vacancies, and Materialized Fit/Gap Reports).
#
# Usage:
#   bundle exec rails db:seed

puts "== Resetting all existing AI Interview data =="

FitGapReport.unscoped.delete_all
AssessorOverride.unscoped.delete_all
PortfolioSkill.unscoped.delete_all
Portfolio.unscoped.delete_all
TranscriptTurn.unscoped.delete_all
CoverageMap.unscoped.delete_all
Session.unscoped.delete_all
AssessmentSkill.unscoped.delete_all
Assessment.unscoped.delete_all
VacancySkill.unscoped.delete_all
Vacancy.unscoped.delete_all
SkillTaxonomy.unscoped.delete_all
User.unscoped.delete_all

ActiveRecord::Base.connection.execute(<<~SQL)
  CREATE TABLE IF NOT EXISTS public.organizations (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(255) NOT NULL,
    scheme      VARCHAR(255) NOT NULL,
    identifier  VARCHAR(255) NOT NULL,
    host        VARCHAR(255) NOT NULL,
    alias_hosts VARCHAR[] NOT NULL DEFAULT '{}',
    config      JSONB NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  TRUNCATE TABLE public.organizations RESTART IDENTITY CASCADE;
SQL

puts "  All tables cleared."
puts ""
puts "== Seeding Organizations & Multi-Tenant Admin Accounts =="

TEST_ORGS = [
  {
    name:       "Test Corp",
    scheme:     "test-corp",
    identifier: "test-corp",
    host:       "localhost"
  },
  {
    name:       "Acme Corp",
    scheme:     "acme-corp",
    identifier: "acme-corp",
    host:       "acme.localhost"
  }
].freeze

TEST_ORGS.each do |org_data|
  result = ActiveRecord::Base.connection.select_one(<<~SQL)
    INSERT INTO public.organizations
      (name, scheme, identifier, host, alias_hosts, config, created_at, updated_at)
    VALUES
      (
        '#{org_data[:name]}',
        '#{org_data[:scheme]}',
        '#{org_data[:identifier]}',
        '#{org_data[:host]}',
        '{}',
        '{}',
        NOW(),
        NOW()
      )
    RETURNING id, name, scheme;
  SQL
  puts "  Created organization: id=#{result['id']} name='#{result['name']}' scheme=#{result['scheme']}"
end

test_org_id = ActiveRecord::Base.connection.select_value("SELECT id FROM public.organizations WHERE scheme = 'test-corp'").to_i
acme_org_id = ActiveRecord::Base.connection.select_value("SELECT id FROM public.organizations WHERE scheme = 'acme-corp'").to_i

admin1 = User.create!(
  email:    "admin@example.com",
  password: "password123",
  role:     "admin",
  scheme:   "test-corp"
)
puts "  [Account 1 - Test Corp] email=admin@example.com password=password123 (scheme=test-corp, tenant_id=#{test_org_id})"

admin2 = User.create!(
  email:    "admin@acme.com",
  password: "password123",
  role:     "admin",
  scheme:   "acme-corp"
)
puts "  [Account 2 - Acme Corp] email=admin@acme.com password=password123 (scheme=acme-corp, tenant_id=#{acme_org_id})"

# ── B7 Skill Taxonomy (22 pilot skills) ──────────────────────────────────────

B7_SKILLS = [
  # ── Engineering ──────────────────────────────────────────────────────────────
  {
    skill_id:     "SK-ENG-001",
    skill_label:  "React / Frontend Development Core",
    category:     "engineering",
    scope_include: "Component design, state management (Redux/Context), hooks, performance optimization, code splitting, testing (Jest/RTL)",
    scope_exclude: "Backend APIs, mobile (React Native), non-React frameworks",
    l1_anchor: "Implements components from specs with close review. Understands JSX and basic hooks (useState, useEffect).",
    l2_anchor: "Builds routine features independently. Uses Context or Redux for shared state. Writes basic unit tests.",
    l3_anchor: "Designs and builds complex features end-to-end. Optimizes rendering (memoization, code splitting). Owns test strategy for their area.",
    l4_anchor: "Defines frontend standards for the team. Leads architecture decisions (state strategy, folder structure, build pipeline).",
    l5_anchor: "Defines frontend architecture strategy for the org. Drives cross-team adoption of patterns. Innovates on DX and performance at scale."
  },
  {
    skill_id:     "SK-ENG-002",
    skill_label:  "Node.js / Backend Development",
    category:     "engineering",
    scope_include: "REST API design, Express/Fastify, async patterns, middleware, error handling, background jobs",
    scope_exclude: "Frontend, mobile, non-Node runtimes (Ruby, Python)",
    l1_anchor: "Implements endpoints from spec with guidance. Understands request/response cycle and basic async (async/await).",
    l2_anchor: "Builds CRUD APIs independently. Handles validation, error middleware, and basic auth patterns.",
    l3_anchor: "Designs service boundaries and data flow. Implements background jobs, caching strategies, and structured logging.",
    l4_anchor: "Defines API standards across services. Leads decisions on runtime patterns, observability, and service resilience.",
    l5_anchor: "Owns backend platform strategy. Drives decisions on runtime selection, distributed system patterns, and org-wide reliability targets."
  },
  {
    skill_id:     "SK-ENG-003",
    skill_label:  "System Design & Architecture",
    category:     "engineering",
    scope_include: "Distributed systems, scalability, trade-off analysis, component boundaries, data flow, reliability patterns",
    scope_exclude: "Low-level hardware, network infrastructure design",
    l1_anchor: "Understands basic client-server model. Can explain what a database, API, and frontend are and how they connect.",
    l2_anchor: "Designs simple systems (single service + DB). Identifies obvious bottlenecks and applies common patterns (caching, queues).",
    l3_anchor: "Designs multi-service systems with clear trade-offs. Considers failure modes, scaling strategies, and data consistency.",
    l4_anchor: "Leads architecture decisions for complex systems. Defines standards for reliability, observability, and inter-service communication.",
    l5_anchor: "Shapes org-wide technical architecture. Evaluates build vs. buy, platform choices, and long-term scalability bets."
  },
  {
    skill_id:     "SK-ENG-004",
    skill_label:  "Database Design & SQL",
    category:     "engineering",
    scope_include: "Schema design, normalization, indexing, query optimization, migrations, transactions, PostgreSQL/MySQL",
    scope_exclude: "NoSQL (covered separately), data warehousing, BI tools",
    l1_anchor: "Writes basic SELECT queries. Understands tables, columns, and primary keys.",
    l2_anchor: "Writes JOINs and aggregations. Designs simple schemas with foreign keys. Runs migrations safely.",
    l3_anchor: "Optimizes slow queries (EXPLAIN, indexing). Designs schemas for performance and correctness. Handles transactions and locking.",
    l4_anchor: "Defines DB standards for the team. Reviews schema changes for production impact. Leads partitioning and replication decisions.",
    l5_anchor: "Owns database strategy at org level. Evaluates DB technology choices, sets reliability and scaling targets, guides DBA practice."
  },
  {
    skill_id:     "SK-ENG-005",
    skill_label:  "RESTful API Design",
    category:     "engineering",
    scope_include: "Resource modeling, HTTP semantics, versioning, auth patterns, pagination, error contracts, OpenAPI/Swagger",
    scope_exclude: "GraphQL, gRPC, frontend consumption",
    l1_anchor: "Implements endpoints following an existing spec. Understands HTTP methods and status codes.",
    l2_anchor: "Designs simple CRUD APIs. Applies REST conventions (nouns, status codes, auth headers). Documents with OpenAPI.",
    l3_anchor: "Designs APIs with clear versioning, pagination, and error contracts. Balances flexibility and backward compatibility.",
    l4_anchor: "Defines API standards across teams. Reviews contracts for consistency and breaking-change risk.",
    l5_anchor: "Drives API platform strategy. Establishes org-wide contracts, deprecation policies, and developer experience standards."
  },
  {
    skill_id:     "SK-ENG-006",
    skill_label:  "Testing & Quality Assurance",
    category:     "engineering",
    scope_include: "Unit tests, integration tests, E2E tests, TDD, test strategy, CI test pipelines, test coverage",
    scope_exclude: "Manual QA processes, load testing (covered in performance), security testing",
    l1_anchor: "Writes basic unit tests with guidance. Understands what a test is and why it matters.",
    l2_anchor: "Writes unit and integration tests independently. Maintains test coverage for own code. Fixes flaky tests.",
    l3_anchor: "Defines test strategy for a feature area. Writes E2E tests. Improves CI pipeline reliability. Advocates for test quality in reviews.",
    l4_anchor: "Defines testing standards for the team. Leads adoption of testing practices (TDD, contract testing). Manages coverage targets.",
    l5_anchor: "Owns quality engineering strategy. Drives org-wide shift in testing culture and tooling investment."
  },
  {
    skill_id:     "SK-ENG-007",
    skill_label:  "DevOps & CI/CD",
    category:     "engineering",
    scope_include: "CI/CD pipelines, Docker, deployment automation, environment management, monitoring basics, incident response",
    scope_exclude: "Cloud infrastructure provisioning (SK-ENG-008), security hardening",
    l1_anchor: "Understands what CI/CD does. Can read a pipeline config and debug a failed build with guidance.",
    l2_anchor: "Maintains and extends existing pipelines. Dockerizes services. Deploys to staging/production following runbooks.",
    l3_anchor: "Designs CI/CD pipelines from scratch. Implements blue/green or canary deployments. Defines rollback procedures.",
    l4_anchor: "Leads DevOps standards for the team. Improves deployment frequency and MTTR. Drives shift-left on reliability.",
    l5_anchor: "Owns deployment platform strategy. Sets org-wide targets for deploy frequency, lead time, and change failure rate (DORA metrics)."
  },
  {
    skill_id:     "SK-ENG-008",
    skill_label:  "Cloud Infrastructure (AWS / GCP / Azure)",
    category:     "engineering",
    scope_include: "Compute (EC2/GCE/VMs), managed services (RDS, S3, Pub/Sub), IaC (Terraform/CDK), networking basics, cost management",
    scope_exclude: "On-premise infrastructure, specialized ML platforms",
    l1_anchor: "Uses cloud console to view resources. Understands what a VM, object storage, and managed DB are.",
    l2_anchor: "Provisions and configures basic cloud resources. Uses IaC templates written by others. Monitors costs and alerts.",
    l3_anchor: "Designs cloud architectures for reliability and cost-efficiency. Writes IaC modules. Leads incident response for cloud services.",
    l4_anchor: "Defines cloud standards for the team. Reviews architecture for security and cost. Drives FinOps practices.",
    l5_anchor: "Owns cloud platform strategy. Evaluates multi-cloud trade-offs. Sets org-level reliability, security, and cost targets."
  },
  {
    skill_id:     "SK-ENG-009",
    skill_label:  "TypeScript & Type Systems",
    category:     "engineering",
    scope_include: "Static typing, generics, utility types, type narrowing, TypeScript config, type-safe API contracts",
    scope_exclude: "JavaScript fundamentals, other typed languages",
    l1_anchor: "Adds basic type annotations with guidance. Understands the difference between typed and untyped code.",
    l2_anchor: "Types own code consistently. Uses interfaces, enums, and basic generics. Fixes type errors independently.",
    l3_anchor: "Designs type-safe abstractions (generics, mapped types, conditional types). Improves type coverage across a codebase.",
    l4_anchor: "Defines typing standards for the team. Reviews PRs for type safety. Leads migration from JS to TS.",
    l5_anchor: "Shapes type system strategy at org level. Drives adoption, tooling investment, and cross-team type contract standards."
  },
  {
    skill_id:     "SK-ENG-010",
    skill_label:  "Security Engineering",
    category:     "engineering",
    scope_include: "OWASP Top 10, auth/authz patterns, secret management, dependency scanning, secure code review",
    scope_exclude: "Penetration testing, network security, physical security",
    l1_anchor: "Aware of common vulnerabilities (XSS, SQL injection). Follows secure coding guidelines with oversight.",
    l2_anchor: "Applies secure defaults independently (input validation, parameterized queries, secret management). Participates in security reviews.",
    l3_anchor: "Leads security reviews for a feature area. Designs auth/authz patterns. Identifies and mitigates OWASP Top 10 risks proactively.",
    l4_anchor: "Defines security standards for the team. Drives secure SDLC adoption. Responds to and leads post-mortems on security incidents.",
    l5_anchor: "Owns security strategy at org level. Drives threat modeling, compliance readiness, and security culture across engineering."
  },

  # ── Soft Skills ───────────────────────────────────────────────────────────────
  {
    skill_id:     "SK-SOFT-001",
    skill_label:  "Communication",
    category:     "soft_skills",
    scope_include: "Clear technical explanation, stakeholder alignment, async written communication, cross-team alignment, presentation",
    scope_exclude: "Public speaking (standalone), marketing communication",
    l1_anchor: "Communicates only when asked. Relies on manager to translate technical work to others.",
    l2_anchor: "Communicates clearly within the team. Writes adequate tickets and docs. Updates stakeholders reactively.",
    l3_anchor: "Communicates proactively across teams. Adapts message to audience (technical vs. non-technical). Facilitates meetings effectively.",
    l4_anchor: "Drives alignment across multiple stakeholders. Resolves miscommunication across teams. Models clear communication for others.",
    l5_anchor: "Shapes communication culture at org level. Influences executives and external stakeholders. Defines async communication norms."
  },
  {
    skill_id:     "SK-SOFT-002",
    skill_label:  "Problem Solving & Analytical Thinking",
    category:     "soft_skills",
    scope_include: "Root cause analysis, breaking down ambiguous problems, hypothesis-driven thinking, trade-off evaluation",
    scope_exclude: "Domain-specific technical problem solving (covered by engineering skills)",
    l1_anchor: "Solves well-defined problems with clear guidance. Struggles with ambiguity.",
    l2_anchor: "Breaks down defined problems independently. Identifies root causes for familiar issues. Asks good clarifying questions.",
    l3_anchor: "Navigates ambiguous problems. Forms and tests hypotheses. Evaluates trade-offs with data. Solves novel problems end-to-end.",
    l4_anchor: "Frames complex, multi-dimensional problems for the team. Teaches structured problem-solving approaches.",
    l5_anchor: "Applies first-principles thinking to org-level challenges. Shapes how the org approaches hard, undefined problems."
  },
  {
    skill_id:     "SK-SOFT-003",
    skill_label:  "Collaboration & Teamwork",
    category:     "soft_skills",
    scope_include: "Working with peers, cross-functional collaboration, giving/receiving feedback, pair programming, shared ownership",
    scope_exclude: "Leadership/management (SK-SOFT-004), conflict resolution (SK-SOFT-007)",
    l1_anchor: "Completes assigned work. Participates when asked. Needs prompting to collaborate.",
    l2_anchor: "Collaborates reliably within the team. Gives and receives feedback constructively. Proactively asks for help.",
    l3_anchor: "Actively builds cross-functional relationships. Unblocks others. Takes shared ownership of team outcomes beyond own tasks.",
    l4_anchor: "Elevates team collaboration. Creates rituals and structures that improve how the team works together.",
    l5_anchor: "Shapes collaboration culture across the org. Drives cross-team initiatives. Models and teaches high-trust collaboration."
  },
  {
    skill_id:     "SK-SOFT-004",
    skill_label:  "Leadership & Ownership",
    category:     "soft_skills",
    scope_include: "Taking initiative, driving outcomes without authority, accountability, decision-making, inspiring others",
    scope_exclude: "People management, formal authority",
    l1_anchor: "Executes tasks assigned. Escalates blockers rather than resolving them. Ownership is limited to own output.",
    l2_anchor: "Takes ownership of own tasks end-to-end. Raises issues proactively. Shows initiative on small improvements.",
    l3_anchor: "Drives outcomes for a feature or project without being told. Makes decisions within scope. Holds self and peers accountable.",
    l4_anchor: "Leads multi-person efforts. Inspires ownership in others. Makes hard calls and owns outcomes when things go wrong.",
    l5_anchor: "Drives org-level initiatives. Shapes culture of ownership. Leads through influence across the org."
  },
  {
    skill_id:     "SK-SOFT-005",
    skill_label:  "Adaptability & Learning Agility",
    category:     "soft_skills",
    scope_include: "Picking up new skills, handling change, recovering from failure, intellectual curiosity, growth mindset",
    scope_exclude: "Technical upskilling in a specific domain (covered by engineering skills)",
    l1_anchor: "Learns within a familiar context. Needs significant support when requirements or tools change.",
    l2_anchor: "Adapts to changing requirements with some support. Learns new tools or patterns within a project.",
    l3_anchor: "Picks up unfamiliar domains quickly and independently. Thrives in ambiguity. Iterates fast from failure.",
    l4_anchor: "Leads the team through major changes (tech pivots, reorgs). Models learning agility for others.",
    l5_anchor: "Shapes org's learning culture. Drives continuous adaptation to market and technology shifts at a strategic level."
  },
  {
    skill_id:     "SK-SOFT-006",
    skill_label:  "Time Management & Prioritization",
    category:     "soft_skills",
    scope_include: "Managing own workload, prioritizing under constraints, estimating effort, handling competing demands",
    scope_exclude: "Project management tooling, team-level planning (SK-PM-002)",
    l1_anchor: "Needs manager to prioritize work. Often misses estimates or context-switches poorly.",
    l2_anchor: "Manages own task list. Meets most deadlines. Flags conflicts early. Improves estimates over time.",
    l3_anchor: "Prioritizes effectively under competing demands. Makes explicit trade-offs. Protects time for high-impact work.",
    l4_anchor: "Helps team prioritize. Eliminates low-value work. Designs processes that improve team throughput.",
    l5_anchor: "Shapes org-level prioritization frameworks. Aligns resource allocation to strategic goals."
  },
  {
    skill_id:     "SK-SOFT-007",
    skill_label:  "Mentoring & Knowledge Sharing",
    category:     "soft_skills",
    scope_include: "1:1 mentoring, code reviews as teaching, documentation, tech talks, onboarding, growing others",
    scope_exclude: "Formal people management, performance reviews",
    l1_anchor: "Absorbs knowledge from others. Does not yet share knowledge proactively.",
    l2_anchor: "Answers questions when asked. Writes basic documentation. Gives feedback in code reviews.",
    l3_anchor: "Proactively mentors junior engineers. Runs knowledge-sharing sessions. Creates onboarding resources.",
    l4_anchor: "Builds a culture of learning in the team. Designs mentoring programs. Elevates multiple engineers simultaneously.",
    l5_anchor: "Shapes learning and knowledge culture org-wide. Invests in platforms and programs that scale knowledge transfer."
  },

  # ── Product & Process ─────────────────────────────────────────────────────────
  {
    skill_id:     "SK-PM-001",
    skill_label:  "Product Thinking",
    category:     "product_process",
    scope_include: "User empathy, outcome vs. output thinking, feature trade-offs, success metrics, working with PMs",
    scope_exclude: "Product management as a role, market research, pricing",
    l1_anchor: "Builds what is specified. Has limited view beyond own task.",
    l2_anchor: "Understands the user problem behind a ticket. Asks why before building. Flags UX concerns.",
    l3_anchor: "Actively shapes solutions with product. Proposes simpler alternatives. Defines success metrics for own features.",
    l4_anchor: "Drives product direction for a domain. Leads discovery with PMs. Connects technical decisions to user and business outcomes.",
    l5_anchor: "Shapes org-level product strategy as a technical leader. Bridges business goals and engineering capabilities at the highest level."
  },
  {
    skill_id:     "SK-PM-002",
    skill_label:  "Agile & Scrum Practices",
    category:     "product_process",
    scope_include: "Sprints, retrospectives, standups, backlog grooming, estimation, iterative delivery",
    scope_exclude: "Formal Scrum Master role, project management tools",
    l1_anchor: "Attends ceremonies. Completes assigned tickets. Limited understanding of sprint goals.",
    l2_anchor: "Participates actively in ceremonies. Estimates reliably. Updates tickets consistently.",
    l3_anchor: "Improves team process. Leads retrospectives. Helps define sprint goals. Identifies and removes blockers early.",
    l4_anchor: "Shapes team's agile practice. Drives continuous improvement. Coaches others on effective iteration.",
    l5_anchor: "Defines delivery culture at org level. Drives cross-team agile adoption and process evolution."
  },
  {
    skill_id:     "SK-PM-003",
    skill_label:  "Data-Driven Decision Making",
    category:     "product_process",
    scope_include: "Using metrics to guide decisions, A/B testing, instrumentation, interpreting dashboards, avoiding vanity metrics",
    scope_exclude: "Data engineering, ML modeling, statistical analysis at research depth",
    l1_anchor: "Makes decisions based on intuition or what was asked. Does not instrument features.",
    l2_anchor: "Instruments own features. Reviews dashboards. Uses data to validate assumptions when prompted.",
    l3_anchor: "Drives instrumentation strategy for a feature area. Designs experiments. Challenges decisions not backed by data.",
    l4_anchor: "Defines metrics strategy for the team. Drives data-informed culture. Reviews analytics for correctness and relevance.",
    l5_anchor: "Shapes org-level data culture. Defines the company's north star metrics. Drives investment in analytics infrastructure."
  },
  {
    skill_id:     "SK-PM-004",
    skill_label:  "Stakeholder Management",
    category:     "product_process",
    scope_include: "Managing expectations, navigating competing priorities, influencing without authority, executive communication",
    scope_exclude: "Client sales, account management",
    l1_anchor: "Works within team scope. Minimal external stakeholder interaction.",
    l2_anchor: "Communicates status to direct stakeholders. Manages expectations reactively. Escalates when needed.",
    l3_anchor: "Proactively aligns stakeholders on scope, timelines, and trade-offs. Navigates competing priorities diplomatically.",
    l4_anchor: "Manages complex stakeholder landscapes across teams. Builds trust with senior leaders. Drives alignment on hard decisions.",
    l5_anchor: "Manages exec and board-level stakeholders. Shapes org narrative. Navigates org politics to drive strategic outcomes."
  },
  {
    skill_id:     "SK-PM-005",
    skill_label:  "Technical Writing & Documentation",
    category:     "product_process",
    scope_include: "READMEs, ADRs, runbooks, API docs, design docs, onboarding guides",
    scope_exclude: "Marketing content, user-facing copy, formal technical publications",
    l1_anchor: "Writes documentation only when required. Quality is minimal and often needs revision.",
    l2_anchor: "Documents own work consistently. Writes clear READMEs and code comments. Updates docs when code changes.",
    l3_anchor: "Writes design docs and ADRs proactively. Creates runbooks and onboarding guides. Improves existing docs.",
    l4_anchor: "Defines documentation standards for the team. Reviews docs for clarity and completeness. Drives documentation culture.",
    l5_anchor: "Shapes org-wide documentation strategy. Defines what gets documented, how, and where. Invests in tooling and standards."
  }
].freeze

puts ""
puts "== Seeding B7 Skill Taxonomy (22 pilot skills) =="

SKILLS_BY_ID = {}
B7_SKILLS.each do |attrs|
  skill = SkillTaxonomy.create!(attrs)
  SKILLS_BY_ID[skill.skill_id] = skill
end
puts "  Done — #{SKILLS_BY_ID.size} skills seeded."

# Helper to add an AssessmentSkill from a SkillTaxonomy ID
def add_assessment_skill!(assessment, skill_id, expected_level, order)
  tax = SKILLS_BY_ID.fetch(skill_id)
  assessment.assessment_skills.create!(
    skill_id:       tax.skill_id,
    skill_label:    tax.skill_label,
    is_custom:      false,
    scope_include:  tax.scope_include,
    scope_exclude:  tax.scope_exclude,
    l1_anchor:      tax.l1_anchor,
    l2_anchor:      tax.l2_anchor,
    l3_anchor:      tax.l3_anchor,
    l4_anchor:      tax.l4_anchor,
    l5_anchor:      tax.l5_anchor,
    expected_level: expected_level,
    display_order:  order
  )
end

# Deterministic stub client for seeding Fit/Gap reports instantaneously without external network wait
class SeedNarrativeStub
  def initialize(culture:, overall:)
    @culture = culture
    @overall = overall
  end

  def generate_content(_prompt, **_opts)
    {
      "culture_narrative" => @culture,
      "overall_narrative" => @overall
    }
  end
end

# ══════════════════════════════════════════════════════════════════════════════
# TENANT 1: TEST CORP (scheme: test-corp)
# ══════════════════════════════════════════════════════════════════════════════
puts ""
puts "== Seeding Tenant 1: Test Corp (scheme=test-corp) =="

Current.using(tenant_id: test_org_id) do
  # 1. Assessments
  a1 = Assessment.create!(
    name:           "Senior Fullstack Product Engineer Assessment",
    time_limit_min: 30,
    language:       "en",
    created_by:     admin1.id
  )
  add_assessment_skill!(a1, "SK-ENG-001", 4, 0) # React / Frontend Development Core
  add_assessment_skill!(a1, "SK-ENG-002", 3, 1) # Node.js / Backend Development
  add_assessment_skill!(a1, "SK-ENG-003", 3, 2) # System Design & Architecture
  add_assessment_skill!(a1, "SK-SOFT-002", 3, 3) # Problem Solving & Analytical Thinking
  a1.update!(system_prompt: Assessments::SystemPromptCompiler.new(a1).call)

  a2 = Assessment.create!(
    name:           "Backend & Cloud Reliability Assessment",
    time_limit_min: 45,
    language:       "en",
    created_by:     admin1.id
  )
  add_assessment_skill!(a2, "SK-ENG-004", 4, 0) # Database Design & SQL
  add_assessment_skill!(a2, "SK-ENG-008", 3, 1) # Cloud Infrastructure
  add_assessment_skill!(a2, "SK-ENG-010", 3, 2) # Security Engineering
  a2.update!(system_prompt: Assessments::SystemPromptCompiler.new(a2).call)

  # 2. Candidate Session 1: Budi Santoso (Completed, Calibrated Override, Discovered Skill, Fit/Gap Reports)
  s1 = Session.create!(
    assessment:       a1,
    candidate_id:     101,
    candidate_name:   "Budi Santoso",
    invite_token:     "test-corp-budi-completed-session-token-001",
    status:           "ended",
    end_reason:       "all_covered",
    started_at:       2.hours.ago,
    ended_at:         96.minutes.ago,
    duration_seconds: 1420
  )

  budi_turns = [
    ["ai",        "Hi Budi, thanks for joining today. Tell me about the most technically demanding frontend and backend architecture you've owned recently.", 0, 8200],
    ["candidate", "Thanks! Over the past year I led the revamp of our multi-tenant talent evaluation dashboard in React 18 and TypeScript. We migrated from scattered prop-drilling and ad-hoc fetch hooks to vertical feature slices backed by TanStack Query with optimistic cache mutations and automatic rollback on failure, which cut perceived UI latency on score overrides to under 16 milliseconds.", 8500, 34200],
    ["ai",        "Optimistic updates across linked views can get tricky when background jobs are still running. How did you prevent stale reads between the portfolio view and downstream reports?", 34800, 44100],
    ["candidate", "Great question. Whenever an assessor saves a skill override, we immediately patch the in-memory React Query cache and recalculate the Fit/Gap comparison deltas client-side using a pure TypeScript reducer. On the backend, the controller persists the AssessorOverride record without mutating the baseline AI score, invalidates affected FitGapReport rows, and enqueues an idempotent Sidekiq worker with exponential backoff.", 44600, 76500],
    ["ai",        "Let's dig into that backend worker and API layer. What happens if Redis is unavailable or if the upstream LLM times out mid-synthesis?", 77100, 86000],
    ["candidate", "We designed every external boundary to fail gracefully. If Sidekiq enqueueing fails because Redis is down, the service rescues the connection error and falls back to an inline background thread using ActiveRecord's connection pool. And if Gemini Flash times out or hits a 429 rate limit, FitGap::Engine catches the error, logs a sanitized warning without PII, and synthesizes a deterministic rule-based narrative so the HTTP endpoint still returns 200 OK.", 86600, 119400],
    ["ai",        "Walk me through a tricky production root-cause investigation where your initial hypothesis turned out to be wrong.", 120000, 127500],
    ["candidate", "We had a P0 report where candidates on macOS heard a repetitive chime and their microphone froze during live interviews. Initially we suspected WebSocket backpressure in ActionCable. I instrumented RMS audio level telemetry and discovered the real culprit: the browser's Web Speech API was competing with our 16kHz AudioWorklet PCM stream for exclusive hardware access. Removing the duplicate SpeechRecognition instance and moving turn detection to a 1.7-second server-side silence timer resolved 100% of the lockups.", 128000, 165000]
  ]
  budi_turns.each_with_index do |(speaker, text, start_ms, end_ms), idx|
    s1.transcript_turns.create!(
      turn_number:    idx + 1,
      speaker:        speaker,
      text:           text,
      audio_start_ms: start_ms,
      audio_end_ms:   end_ms
    )
  end

  [
    ["SK-ENG-001", "React / Frontend Development Core", false, "covered", 3, "Strong L4 architecture signal on vertical slices & optimistic query cache"],
    ["SK-ENG-002", "Node.js / Backend Development", false, "covered", 2, "Solid background job resilience, idempotency, and fallback handling"],
    ["SK-ENG-003", "System Design & Architecture", false, "covered", 3, "Clear multi-tenant isolation, read-through caching, and failure mode design"],
    ["SK-SOFT-002", "Problem Solving & Analytical Thinking", false, "covered", 2, "Hypothesis-driven debugging of macOS WebAudio vs SpeechRecognition lockup"],
    ["SK-ENG-009", "TypeScript & Type Systems", true, "covered", 2, "Spontaneously demonstrated strict type-safe API contracts and reducers"]
  ].each do |skill_id, label, discovered, state, probes, signal|
    s1.coverage_maps.create!(
      skill_id:      skill_id,
      skill_label:   label,
      is_discovered: discovered,
      state:         state,
      probe_count:   probes,
      last_signal:   signal
    )
  end

  p1 = Portfolio.create!(
    session:           s1,
    candidate_id:      s1.candidate_id,
    generation_status: "complete",
    generated_at:      95.minutes.ago
  )

  p1.portfolio_skills.create!(
    skill_id:           "SK-ENG-001",
    skill_label:        "React / Frontend Development Core",
    is_discovered:      false,
    ai_level:           4,
    ai_confidence:      "high",
    assessment_state:   "assessed",
    competency_summary: "Demonstrates L4 mastery of React 18 architecture, leading a migration to vertical feature slices and TanStack Query with optimistic mutations, rollback handling, and cross-feature cache synchronization.",
    evidence:           [
      "Over the past year I led the revamp of our multi-tenant talent evaluation dashboard in React 18 and TypeScript. We migrated from scattered prop-drilling and ad-hoc fetch hooks to vertical feature slices backed by TanStack Query with optimistic cache mutations and automatic rollback on failure, which cut perceived UI latency on score overrides to under 16 milliseconds.",
      "Whenever an assessor saves a skill override, we immediately patch the in-memory React Query cache and recalculate the Fit/Gap comparison deltas client-side using a pure TypeScript reducer."
    ]
  )

  budi_node_skill = p1.portfolio_skills.create!(
    skill_id:           "SK-ENG-002",
    skill_label:        "Node.js / Backend Development",
    is_discovered:      false,
    ai_level:           3,
    ai_confidence:      "high",
    assessment_state:   "assessed",
    competency_summary: "Designs resilient backend service boundaries with non-destructive audit models, idempotent background jobs, and deterministic fallbacks when Redis or upstream AI APIs fail.",
    evidence:           [
      "On the backend, the controller persists the AssessorOverride record without mutating the baseline AI score, invalidates affected FitGapReport rows, and enqueues an idempotent Sidekiq worker with exponential backoff.",
      "If Sidekiq enqueueing fails because Redis is down, the service rescues the connection error and falls back to an inline background thread using ActiveRecord's connection pool."
    ]
  )

  # Human Assessor Override on Budi's Backend skill (AI L3 -> Override L4)
  AssessorOverride.create!(
    portfolio_skill: budi_node_skill,
    ai_level:        3,
    override_level:  4,
    assessor_notes:  "Calibrated from L3 to L4: Candidate demonstrated staff-level production ownership of idempotent worker design, connection-pool thread safety, and multi-tenant cache invalidation.",
    overridden_by:   admin1.id,
    overridden_at:   60.minutes.ago
  )

  p1.portfolio_skills.create!(
    skill_id:           "SK-ENG-003",
    skill_label:        "System Design & Architecture",
    is_discovered:      false,
    ai_level:           3,
    ai_confidence:      "high",
    assessment_state:   "assessed",
    competency_summary: "Articulates clear trade-offs between compute-on-read and materialized compute-on-write architectures, with explicit failure paths for LLM timeouts and rate limits.",
    evidence:           [
      "We designed every external boundary to fail gracefully... if Gemini Flash times out or hits a 429 rate limit, FitGap::Engine catches the error, logs a sanitized warning without PII, and synthesizes a deterministic rule-based narrative so the HTTP endpoint still returns 200 OK."
    ]
  )

  p1.portfolio_skills.create!(
    skill_id:           "SK-SOFT-002",
    skill_label:        "Problem Solving & Analytical Thinking",
    is_discovered:      false,
    ai_level:           4,
    ai_confidence:      "high",
    assessment_state:   "assessed",
    competency_summary: "Uses hypothesis-driven instrumentation to isolate complex cross-layer hardware and browser audio bugs rather than guessing.",
    evidence:           [
      "Initially we suspected WebSocket backpressure in ActionCable. I instrumented RMS audio level telemetry and discovered the real culprit: the browser's Web Speech API was competing with our 16kHz AudioWorklet PCM stream for exclusive hardware access."
    ]
  )

  p1.portfolio_skills.create!(
    skill_id:           "SK-ENG-009",
    skill_label:        "TypeScript & Type Systems",
    is_discovered:      true,
    ai_level:           4,
    ai_confidence:      "medium",
    assessment_state:   "assessed",
    competency_summary: "Discovered during frontend architecture discussion: enforces strict end-to-end TypeScript contracts and pure typed reducers across evaluation slices.",
    evidence:           [
      "We immediately patch the in-memory React Query cache and recalculate the Fit/Gap comparison deltas client-side using a pure TypeScript reducer."
    ]
  )

  # 3. Candidate Session 2: Siti Rahmawati (Completed — Mid-Level Profile with Skill Gaps)
  s2 = Session.create!(
    assessment:       a1,
    candidate_id:     102,
    candidate_name:   "Siti Rahmawati",
    invite_token:     "test-corp-siti-completed-session-token-002",
    status:           "ended",
    end_reason:       "all_covered",
    started_at:       4.hours.ago,
    ended_at:         220.minutes.ago,
    duration_seconds: 1180
  )

  [
    ["ai",        "Welcome Siti! Could you share a recent React project where you owned component architecture and state management?", 0, 7100],
    ["candidate", "Sure! I led the design system and checkout flow revamp in React and Tailwind. I built reusable compound components with Radix primitives, added keyboard accessibility and responsive breakpoints from 375px to 1440px, and reduced bundle size by 28% with route-level code splitting.", 7500, 31000],
    ["ai",        "How much experience have you had designing backend services or distributed system architectures?", 31500, 38000],
    ["candidate", "On the backend I mostly build standard CRUD endpoints and wire up validation middleware from existing specs. For larger system design decisions like queue partitioning or multi-service caching, I usually partner with our tech lead rather than designing them from scratch.", 38500, 62000],
    ["ai",        "When a UI bug is reported with vague reproduction steps, how do you approach debugging it?", 62500, 69000],
    ["candidate", "I start by reproducing the issue in staging, inspecting network payloads and React DevTools profiler flamegraphs, and writing a failing Vitest regression test before shipping the fix.", 69500, 89000]
  ].each_with_index do |(speaker, text, start_ms, end_ms), idx|
    s2.transcript_turns.create!(turn_number: idx + 1, speaker: speaker, text: text, audio_start_ms: start_ms, audio_end_ms: end_ms)
  end

  [
    ["SK-ENG-001", "React / Frontend Development Core", false, "covered", 2, "Strong UI component architecture, accessibility, and code splitting"],
    ["SK-ENG-002", "Node.js / Backend Development", false, "covered", 2, "Builds routine CRUD APIs; relies on senior guidance for async workers"],
    ["SK-ENG-003", "System Design & Architecture", false, "covered", 2, "L2 single-service familiarity; limited distributed systems design"],
    ["SK-SOFT-002", "Problem Solving & Analytical Thinking", false, "covered", 2, "Structured reproduction and test-first debugging"],
    ["SK-SOFT-001", "Communication", true, "covered", 1, "Clear, concise explanation of trade-offs and scope boundaries"]
  ].each do |skill_id, label, discovered, state, probes, signal|
    s2.coverage_maps.create!(skill_id: skill_id, skill_label: label, is_discovered: discovered, state: state, probe_count: probes, last_signal: signal)
  end

  p2 = Portfolio.create!(
    session:           s2,
    candidate_id:      s2.candidate_id,
    generation_status: "complete",
    generated_at:      218.minutes.ago
  )

  p2.portfolio_skills.create!(
    skill_id: "SK-ENG-001", skill_label: "React / Frontend Development Core", is_discovered: false,
    ai_level: 4, ai_confidence: "high", assessment_state: "assessed",
    competency_summary: "Strong frontend craft: builds accessible Radix compound components, responsive layouts, and route-level code splitting.",
    evidence: ["I built reusable compound components with Radix primitives, added keyboard accessibility and responsive breakpoints from 375px to 1440px, and reduced bundle size by 28% with route-level code splitting."]
  )
  p2.portfolio_skills.create!(
    skill_id: "SK-ENG-002", skill_label: "Node.js / Backend Development", is_discovered: false,
    ai_level: 2, ai_confidence: "high", assessment_state: "assessed",
    competency_summary: "Builds standard CRUD endpoints and validation middleware independently, but has limited experience with async workers and service boundaries.",
    evidence: ["On the backend I mostly build standard CRUD endpoints and wire up validation middleware from existing specs."]
  )
  p2.portfolio_skills.create!(
    skill_id: "SK-ENG-003", skill_label: "System Design & Architecture", is_discovered: false,
    ai_level: 2, ai_confidence: "medium", assessment_state: "assessed",
    competency_summary: "Understands single-service and database patterns; relies on senior leads for multi-service scaling and queue architecture.",
    evidence: ["For larger system design decisions like queue partitioning or multi-service caching, I usually partner with our tech lead rather than designing them from scratch."]
  )
  p2.portfolio_skills.create!(
    skill_id: "SK-SOFT-002", skill_label: "Problem Solving & Analytical Thinking", is_discovered: false,
    ai_level: 3, ai_confidence: "high", assessment_state: "assessed",
    competency_summary: "Methodical root-cause analysis using profiler flamegraphs and regression tests.",
    evidence: ["I start by reproducing the issue in staging, inspecting network payloads and React DevTools profiler flamegraphs, and writing a failing Vitest regression test before shipping the fix."]
  )
  p2.portfolio_skills.create!(
    skill_id: "SK-SOFT-001", skill_label: "Communication", is_discovered: true,
    ai_level: 3, ai_confidence: "high", assessment_state: "assessed",
    competency_summary: "Communicates technical contributions and personal scope boundaries with transparency and clarity.",
    evidence: ["For larger system design decisions like queue partitioning or multi-service caching, I usually partner with our tech lead rather than designing them from scratch."]
  )

  # 4. Candidate Session 3 & 4: Pending Invites Ready for Live Interview Demo
  s3 = Session.create!(
    assessment:     a1,
    candidate_id:   103,
    candidate_name: "Andi Pratama (Ready to Interview)",
    invite_token:   "test-corp-andi-live-interview-demo",
    status:         "pending"
  )
  a1.assessment_skills.each do |ask|
    s3.coverage_maps.create!(skill_id: ask.skill_id, skill_label: ask.skill_label, is_discovered: false, state: "not_yet", probe_count: 0)
  end

  s4 = Session.create!(
    assessment:     a2,
    candidate_id:   104,
    candidate_name: "Dewi Lestari (Cloud Architecture Invite)",
    invite_token:   "test-corp-dewi-cloud-interview-demo",
    status:         "pending"
  )
  a2.assessment_skills.each do |ask|
    s4.coverage_maps.create!(skill_id: ask.skill_id, skill_label: ask.skill_label, is_discovered: false, state: "not_yet", probe_count: 0)
  end

  # 5. Vacancies & Materialized Fit/Gap Reports for Test Corp
  v1 = Vacancy.create!(
    role_title:              "Senior Frontend Engineer",
    created_by:              admin1.id,
    culture_dimensions:      "Monozukuri craftsmanship, high ownership, collaborative code reviews, and user empathy.",
    competency_expectations: "L4 React & modern state architecture, L3 backend API integration, L3 system design, and L3 automated testing."
  )
  v1.vacancy_skills.create!(skill_id: "SK-ENG-001", skill_label: "React / Frontend Development Core", expected_level: 4)
  v1.vacancy_skills.create!(skill_id: "SK-ENG-002", skill_label: "Node.js / Backend Development", expected_level: 3)
  v1.vacancy_skills.create!(skill_id: "SK-ENG-003", skill_label: "System Design & Architecture", expected_level: 3)
  v1.vacancy_skills.create!(skill_id: "SK-ENG-006", skill_label: "Testing & Quality Assurance", expected_level: 3) # Not Assessed in interview!

  v2 = Vacancy.create!(
    role_title:              "Staff Fullstack Product Engineer",
    created_by:              admin1.id,
    culture_dimensions:      "First-principles thinking, end-to-end product accountability, and technical mentorship.",
    competency_expectations: "L4 across React, Node.js, System Design, and Analytical Problem Solving, plus L3 Leadership."
  )
  v2.vacancy_skills.create!(skill_id: "SK-ENG-001", skill_label: "React / Frontend Development Core", expected_level: 4)
  v2.vacancy_skills.create!(skill_id: "SK-ENG-002", skill_label: "Node.js / Backend Development", expected_level: 4)
  v2.vacancy_skills.create!(skill_id: "SK-ENG-003", skill_label: "System Design & Architecture", expected_level: 4)
  v2.vacancy_skills.create!(skill_id: "SK-SOFT-002", skill_label: "Problem Solving & Analytical Thinking", expected_level: 4)
  v2.vacancy_skills.create!(skill_id: "SK-SOFT-004", skill_label: "Leadership & Ownership", expected_level: 3) # Not Assessed

  FitGap::Engine.new(
    portfolio: p1,
    vacancy:   v1,
    gemini_client: SeedNarrativeStub.new(
      culture: "Budi exhibits exceptional Monozukuri craftsmanship and ownership, backed by verifiable evidence of leading vertical slice migrations and root-cause hardware debugging.",
      overall: "Strong Hire for Senior Frontend Engineer: Budi matches L4 React and L3 System Design expectations, exceeds Node.js requirements (L4 calibrated override vs L3 target), and brings bonus L4 TypeScript depth. Recommend a brief follow-up on Testing & QA (not assessed in session)."
    )
  ).call

  FitGap::Engine.new(
    portfolio: p1,
    vacancy:   v2,
    gemini_client: SeedNarrativeStub.new(
      culture: "Strong alignment with first-principles product engineering; Budi consistently connects low-level technical trade-offs to recruiter and candidate UX outcomes.",
      overall: "Promising Staff Fullstack candidate: Matches L4 across React, calibrated Node.js, and Problem Solving, with a -1 level gap on System Design (L3 vs L4 target) and unassessed formal Leadership."
    )
  ).call

  FitGap::Engine.new(
    portfolio: p2,
    vacancy:   v1,
    gemini_client: SeedNarrativeStub.new(
      culture: "Siti demonstrates strong UI craftsmanship, accessibility empathy, and transparent communication across team boundaries.",
      overall: "Conditional Fit for Senior Frontend Engineer: Matches the core L4 React requirement, but exhibits -1 gaps in Node.js (L2 vs L3) and System Design (L2 vs L3). Ideal for a frontend-focused squad with backend mentorship."
    )
  ).call

  FitGap::Engine.new(
    portfolio: p2,
    vacancy:   v2,
    gemini_client: SeedNarrativeStub.new(
      culture: "Collaborative and methodical on frontend quality, though currently operating at a mid-level scope on cross-service architecture.",
      overall: "Not yet ready for Staff Fullstack Product Engineer: Meets L4 React, but has -2 gaps in Node.js and System Design (L2 vs L4) and -1 gap in Problem Solving (L3 vs L4)."
    )
  ).call

  puts "  [Test Corp] Seeded 2 Assessments, 4 Sessions (2 Completed with Portfolios/Overrides + 2 Pending), 2 Vacancies, and 4 Fit/Gap Reports."
end

# ══════════════════════════════════════════════════════════════════════════════
# TENANT 2: ACME CORP (scheme: acme-corp)
# ══════════════════════════════════════════════════════════════════════════════
puts ""
puts "== Seeding Tenant 2: Acme Corp (scheme=acme-corp) =="

Current.using(tenant_id: acme_org_id) do
  # 1. Assessment
  acme_a1 = Assessment.create!(
    name:           "Acme Lead Product Manager Assessment",
    time_limit_min: 30,
    language:       "en",
    created_by:     admin2.id
  )
  add_assessment_skill!(acme_a1, "SK-PM-001", 4, 0)   # Product Thinking
  add_assessment_skill!(acme_a1, "SK-PM-003", 4, 1)   # Data-Driven Decision Making
  add_assessment_skill!(acme_a1, "SK-PM-004", 4, 2)   # Stakeholder Management
  add_assessment_skill!(acme_a1, "SK-SOFT-001", 4, 3) # Communication
  acme_a1.update!(system_prompt: Assessments::SystemPromptCompiler.new(acme_a1).call)

  # 2. Completed Candidate Session: Rizky Mahendra
  acme_s1 = Session.create!(
    assessment:       acme_a1,
    candidate_id:     201,
    candidate_name:   "Rizky Mahendra",
    invite_token:     "acme-corp-rizky-completed-session-token-001",
    status:           "ended",
    end_reason:       "all_covered",
    started_at:       3.hours.ago,
    ended_at:         155.minutes.ago,
    duration_seconds: 1510
  )

  [
    ["ai",        "Hi Rizky, welcome to the Acme Corp product leadership interview. Tell me about a product bet you led where you had to reframe the problem before building.", 0, 8000],
    ["candidate", "At our B2B SaaS platform, enterprise customers asked for custom PDF workflow builders. Instead of building a 6-month drag-and-drop editor, I shadowed 14 hiring managers and realized 90% of their friction was simply comparing candidate rubric deltas side-by-side. We shipped a structured Fit/Gap matrix in 3 weeks that increased shortlist conversion by 41%.", 8400, 35000],
    ["ai",        "How did you instrument that launch and guard against vanity metrics?", 35500, 41200],
    ["candidate", "We avoided raw page-view counts and defined our North Star around 'Time-to-Calibrated-Shortlist' paired with a guardrail metric tracking assessor override rate. We ran a 4-week cohort experiment across 32 enterprise tenants and verified statistical significance before deprecating the legacy export flow.", 41800, 68000],
    ["ai",        "Tell me about a time when engineering, legal compliance, and sales executives disagreed on your roadmap.", 68600, 76000],
    ["candidate", "When Indonesia's UU PDP data privacy regulations took effect, sales wanted instant transcript sharing while legal wanted strict retention locks. I facilitated a joint architecture review, proposed non-destructive assessor overrides with PII-scrubbed audit logs, and got unanimous sign-off from both the DPO and VP of Sales within 48 hours.", 76500, 108000]
  ].each_with_index do |(speaker, text, start_ms, end_ms), idx|
    acme_s1.transcript_turns.create!(turn_number: idx + 1, speaker: speaker, text: text, audio_start_ms: start_ms, audio_end_ms: end_ms)
  end

  [
    ["SK-PM-001", "Product Thinking", false, "covered", 2, "Reframed 6-month feature request into 3-week high-leverage outcome"],
    ["SK-PM-003", "Data-Driven Decision Making", false, "covered", 2, "Rigorous North Star + guardrail cohort experimentation"],
    ["SK-PM-004", "Stakeholder Management", false, "covered", 2, "Aligned VP Sales and Legal DPO around UU PDP compliance"],
    ["SK-SOFT-001", "Communication", false, "covered", 2, "Structured executive storytelling and clear trade-off framing"],
    ["SK-SOFT-004", "Leadership & Ownership", true, "covered", 1, "Discovered strong cross-functional initiative under regulatory pressure"]
  ].each do |skill_id, label, discovered, state, probes, signal|
    acme_s1.coverage_maps.create!(skill_id: skill_id, skill_label: label, is_discovered: discovered, state: state, probe_count: probes, last_signal: signal)
  end

  acme_p1 = Portfolio.create!(
    session:           acme_s1,
    candidate_id:      acme_s1.candidate_id,
    generation_status: "complete",
    generated_at:      154.minutes.ago
  )

  acme_p1.portfolio_skills.create!(
    skill_id: "SK-PM-001", skill_label: "Product Thinking", is_discovered: false,
    ai_level: 4, ai_confidence: "high", assessment_state: "assessed",
    competency_summary: "Demonstrates L4 outcome-over-output product discovery, cutting a 6-month feature request down to a 3-week solution that lifted conversion by 41%.",
    evidence: ["Instead of building a 6-month drag-and-drop editor, I shadowed 14 hiring managers and realized 90% of their friction was simply comparing candidate rubric deltas side-by-side. We shipped a structured Fit/Gap matrix in 3 weeks that increased shortlist conversion by 41%."]
  )
  acme_p1.portfolio_skills.create!(
    skill_id: "SK-PM-003", skill_label: "Data-Driven Decision Making", is_discovered: false,
    ai_level: 4, ai_confidence: "high", assessment_state: "assessed",
    competency_summary: "Pairs North Star outcome metrics with quality guardrails in controlled multi-tenant cohort experiments.",
    evidence: ["We avoided raw page-view counts and defined our North Star around 'Time-to-Calibrated-Shortlist' paired with a guardrail metric tracking assessor override rate."]
  )
  rizky_stakeholder_skill = acme_p1.portfolio_skills.create!(
    skill_id: "SK-PM-004", skill_label: "Stakeholder Management", is_discovered: false,
    ai_level: 3, ai_confidence: "high", assessment_state: "assessed",
    competency_summary: "Navigates competing executive and regulatory priorities between sales and legal teams.",
    evidence: ["I facilitated a joint architecture review, proposed non-destructive assessor overrides with PII-scrubbed audit logs, and got unanimous sign-off from both the DPO and VP of Sales within 48 hours."]
  )
  AssessorOverride.create!(
    portfolio_skill: rizky_stakeholder_skill,
    ai_level:        3,
    override_level:  4,
    assessor_notes:  "Calibrated from L3 to L4: Resolving a deadlocked UU PDP compliance conflict between Legal DPO and VP of Sales in 48 hours is a textbook L4 executive alignment example.",
    overridden_by:   admin2.id,
    overridden_at:   45.minutes.ago
  )
  acme_p1.portfolio_skills.create!(
    skill_id: "SK-SOFT-001", skill_label: "Communication", is_discovered: false,
    ai_level: 4, ai_confidence: "high", assessment_state: "assessed",
    competency_summary: "Articulates product hypotheses, metrics, and regulatory constraints with executive clarity.",
    evidence: ["We shipped a structured Fit/Gap matrix in 3 weeks that increased shortlist conversion by 41%."]
  )
  acme_p1.portfolio_skills.create!(
    skill_id: "SK-SOFT-004", skill_label: "Leadership & Ownership", is_discovered: true,
    ai_level: 4, ai_confidence: "medium", assessment_state: "assessed",
    competency_summary: "Discovered skill: drives cross-departmental alignment without formal authority.",
    evidence: ["I facilitated a joint architecture review, proposed non-destructive assessor overrides with PII-scrubbed audit logs, and got unanimous sign-off."]
  )

  # 3. Pending Candidate Session for Acme Corp
  acme_s2 = Session.create!(
    assessment:     acme_a1,
    candidate_id:   202,
    candidate_name: "Nadia Putri (Ready to Interview)",
    invite_token:   "acme-corp-nadia-live-interview-demo",
    status:         "pending"
  )
  acme_a1.assessment_skills.each do |ask|
    acme_s2.coverage_maps.create!(skill_id: ask.skill_id, skill_label: ask.skill_label, is_discovered: false, state: "not_yet", probe_count: 0)
  end

  # 4. Vacancies & Fit/Gap Reports for Acme Corp
  acme_v1 = Vacancy.create!(
    role_title:              "Acme Lead Product Manager",
    created_by:              admin2.id,
    culture_dimensions:      "Customer obsession, high bias for action, data-informed experimentation, and regulatory trust.",
    competency_expectations: "L4 Product Thinking, L4 Data-Driven Decision Making, L4 Stakeholder Management, and L3 Technical Writing."
  )
  acme_v1.vacancy_skills.create!(skill_id: "SK-PM-001", skill_label: "Product Thinking", expected_level: 4)
  acme_v1.vacancy_skills.create!(skill_id: "SK-PM-003", skill_label: "Data-Driven Decision Making", expected_level: 4)
  acme_v1.vacancy_skills.create!(skill_id: "SK-PM-004", skill_label: "Stakeholder Management", expected_level: 4)
  acme_v1.vacancy_skills.create!(skill_id: "SK-PM-005", skill_label: "Technical Writing & Documentation", expected_level: 3) # Not Assessed

  acme_v2 = Vacancy.create!(
    role_title:              "VP of Product Strategy",
    created_by:              admin2.id,
    culture_dimensions:      "Org-wide product vision, board-level communication, and multi-year portfolio bets.",
    competency_expectations: "L5 Product Thinking, L5 Data-Driven Decision Making, L4 Stakeholder Management, and L4 Communication."
  )
  acme_v2.vacancy_skills.create!(skill_id: "SK-PM-001", skill_label: "Product Thinking", expected_level: 5)
  acme_v2.vacancy_skills.create!(skill_id: "SK-PM-003", skill_label: "Data-Driven Decision Making", expected_level: 5)
  acme_v2.vacancy_skills.create!(skill_id: "SK-PM-004", skill_label: "Stakeholder Management", expected_level: 4)
  acme_v2.vacancy_skills.create!(skill_id: "SK-SOFT-001", skill_label: "Communication", expected_level: 4)

  FitGap::Engine.new(
    portfolio: acme_p1,
    vacancy:   acme_v1,
    gemini_client: SeedNarrativeStub.new(
      culture: "Rizky embodies Acme Corp's customer obsession and data-informed culture, backed by concrete B2B SaaS discovery and UU PDP governance outcomes.",
      overall: "Strong Hire for Acme Lead Product Manager: Matches L4 across Product Thinking, Data-Driven Decision Making, and calibrated Stakeholder Management, with bonus L4 Leadership & Communication."
    )
  ).call

  FitGap::Engine.new(
    portfolio: acme_p1,
    vacancy:   acme_v2,
    gemini_client: SeedNarrativeStub.new(
      culture: "Strong executive presence and cross-functional influence, operating solidly at L4 Lead PM scope with clear trajectory toward VP-level strategy.",
      overall: "High-Potential Bench for VP of Product Strategy: Matches L4 Stakeholder Management and Communication, with -1 level growth gaps on org-wide L5 Product Thinking and L5 Data Strategy."
    )
  ).call

  puts "  [Acme Corp] Seeded 1 Assessment, 2 Sessions (1 Completed with Portfolio/Override + 1 Pending), 2 Vacancies, and 2 Fit/Gap Reports."
end

puts ""
puts "== Done! Multi-Tenant Demo Environment Reset & Seeded =="
puts ""
puts "Account 1 — Test Corp (tenant_id: #{test_org_id}, scheme: test-corp):"
puts "  Email    : admin@example.com"
puts "  Password : password123"
puts "  Data     : 2 Assessments, 4 Sessions (Budi Santoso, Siti Rahmawati, Andi Pratama, Dewi Lestari), 2 Vacancies, 4 Fit/Gap Reports"
puts ""
puts "Account 2 — Acme Corp (tenant_id: #{acme_org_id}, scheme: acme-corp):"
puts "  Email    : admin@acme.com"
puts "  Password : password123"
puts "  Data     : 1 Assessment, 2 Sessions (Rizky Mahendra, Nadia Putri), 2 Vacancies, 2 Fit/Gap Reports"
puts ""
