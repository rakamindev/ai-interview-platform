# frozen_string_literal: true

# Seeds for local development and testing.
# Safe to re-run — all operations are idempotent.
#
# Usage:
#   bundle exec rails db:seed
#
# After seeding, use the Rails console to mint a JWT for testing:
#   bundle exec rails console
#   > token = JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: 'test-corp' })
#   > puts token

puts "== Seeding AI Interview development data =="

# ── Organization ─────────────────────────────────────────────────────────────
#
# We write directly to public.organizations (shared with rakamin-api).
# We use raw SQL so we don't have to mirror all of rakamin-api's validations
# and callbacks in our read-only Organization model.
#
# Columns required by the rakamin-api schema:
#   name        — display name
#   scheme      — used as the Apartment schema name AND as the JWT `scheme` claim
#   identifier  — URL-safe slug (lowercase, min 3 chars)
#   host        — primary host for HostService resolution
#   alias_hosts — additional hosts (postgres array)
#   config      — JSONB config blob (Configurable concern)
#
# id = 0 is reserved in rakamin-api as the "default" org — do not use it here.

TEST_ORG = {
  name:       "Test Corp",
  scheme:     "test-corp",
  identifier: "test-corp",
  host:       "localhost"
}.freeze

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
SQL

existing = ActiveRecord::Base.connection.select_one(
  "SELECT id, name, scheme FROM public.organizations WHERE scheme = '#{TEST_ORG[:scheme]}' LIMIT 1"
)

if existing
  puts "  Organization already exists: id=#{existing['id']} scheme=#{existing['scheme']} (skipped)"
else
  result = ActiveRecord::Base.connection.select_one(<<~SQL)
    INSERT INTO public.organizations
      (name, scheme, identifier, host, alias_hosts, config, created_at, updated_at)
    VALUES
      (
        '#{TEST_ORG[:name]}',
        '#{TEST_ORG[:scheme]}',
        '#{TEST_ORG[:identifier]}',
        '#{TEST_ORG[:host]}',
        '{}',
        '{}',
        NOW(),
        NOW()
      )
    RETURNING id, name, scheme;
  SQL

  puts "  Created organization: id=#{result['id']} scheme=#{result['scheme']}"
end

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

B7_SKILLS.each do |attrs|
  skill = SkillTaxonomy.find_or_initialize_by(skill_id: attrs[:skill_id])
  skill.assign_attributes(attrs)

  if skill.save
    action = skill.previously_new_record? ? "Created" : "Updated"
    puts "  #{action}: #{skill.skill_id} — #{skill.skill_label}"
  else
    puts "  ERROR #{attrs[:skill_id]}: #{skill.errors.full_messages.join(', ')}"
  end
end

puts "  Done — #{B7_SKILLS.size} skills seeded."
puts ""

# ── Users ─────────────────────────────────────────────────────────────────────
puts "== Seeding Users =="

admin_user = User.find_or_initialize_by(email: "admin@test-corp.local")
if admin_user.new_record?
  admin_user.assign_attributes(password: "password123", role: "admin")
  admin_user.save!
  puts "  Created admin user: id=#{admin_user.id} email=#{admin_user.email}"
else
  puts "  Admin user already exists: id=#{admin_user.id} (skipped)"
end

candidate_user = User.find_or_initialize_by(email: "candidate@test-corp.local")
if candidate_user.new_record?
  candidate_user.assign_attributes(password: "password123", role: "user")
  candidate_user.save!
  puts "  Created candidate user: id=#{candidate_user.id} email=#{candidate_user.email}"
else
  puts "  Candidate user already exists: id=#{candidate_user.id} (skipped)"
end

org = ActiveRecord::Base.connection.select_one(
  "SELECT id, scheme FROM public.organizations WHERE scheme = '#{TEST_ORG[:scheme]}' LIMIT 1"
)
org_id = org['id'].to_i

# ── Assessment ────────────────────────────────────────────────────────────────
puts ""
puts "== Seeding Assessment =="

assessment = Assessment.find_or_initialize_by(
  tenant_id:  org_id,
  name:       "Senior Frontend Engineer Interview"
)

if assessment.new_record?
  assessment.assign_attributes(
    created_by:    admin_user.id,
    time_limit_min: 60,
    language:      "en",
    system_prompt: <<~PROMPT.strip
      You are an expert technical interviewer assessing a candidate for a Senior Frontend Engineer role.
      Be thorough but conversational. Probe for depth on React, TypeScript, and system design.
      Cover all required skills before ending the session.
    PROMPT
  )
  assessment.save!
  puts "  Created assessment: id=#{assessment.id} name=#{assessment.name}"
else
  puts "  Assessment already exists: id=#{assessment.id} (skipped)"
end

# ── Assessment Skills ─────────────────────────────────────────────────────────
puts ""
puts "== Seeding Assessment Skills =="

ASSESSMENT_SKILL_DEFS = [
  { skill_id: "SK-ENG-001", skill_label: "React / Frontend Development Core", expected_level: 4, display_order: 1 },
  { skill_id: "SK-ENG-009", skill_label: "TypeScript & Type Systems",          expected_level: 3, display_order: 2 },
  { skill_id: "SK-ENG-003", skill_label: "System Design & Architecture",       expected_level: 3, display_order: 3 },
  { skill_id: "SK-ENG-006", skill_label: "Testing & Quality Assurance",        expected_level: 3, display_order: 4 },
  { skill_id: "SK-SOFT-001", skill_label: "Communication",                     expected_level: 3, display_order: 5 },
].freeze

ASSESSMENT_SKILL_DEFS.each do |defn|
  taxonomy = SkillTaxonomy.find_by(skill_id: defn[:skill_id])
  unless taxonomy
    puts "  WARN: taxonomy #{defn[:skill_id]} not found, skipping"
    next
  end

  skill = AssessmentSkill.find_or_initialize_by(
    assessment_id: assessment.id,
    skill_id:      defn[:skill_id]
  )

  if skill.new_record?
    skill.assign_attributes(
      skill_label:    defn[:skill_label],
      is_custom:      false,
      expected_level: defn[:expected_level],
      display_order:  defn[:display_order],
      scope_include:  taxonomy.scope_include,
      scope_exclude:  taxonomy.scope_exclude,
      l1_anchor:      taxonomy.l1_anchor,
      l2_anchor:      taxonomy.l2_anchor,
      l3_anchor:      taxonomy.l3_anchor,
      l4_anchor:      taxonomy.l4_anchor,
      l5_anchor:      taxonomy.l5_anchor
    )
    skill.save!
    puts "  Created assessment skill: #{defn[:skill_id]} — #{defn[:skill_label]}"
  else
    puts "  Assessment skill already exists: #{defn[:skill_id]} (skipped)"
  end
end

# ── Session ───────────────────────────────────────────────────────────────────
puts ""
puts "== Seeding Session =="

session = Session.find_or_initialize_by(
  tenant_id:     org_id,
  assessment_id: assessment.id,
  candidate_id:  candidate_user.id
)

if session.new_record?
  session.assign_attributes(
    candidate_name: "Budi Santoso",
    status:         "ended",
    end_reason:     "all_covered",
    started_at:     2.hours.ago,
    ended_at:       1.hour.ago,
    duration_seconds: 3540
  )
  session.save!
  puts "  Created session: id=#{session.id} candidate=#{session.candidate_name}"
else
  puts "  Session already exists: id=#{session.id} (skipped)"
end

# ── Transcript Turns ──────────────────────────────────────────────────────────
puts ""
puts "== Seeding Transcript Turns =="

TRANSCRIPT = [
  { turn: 1, speaker: "ai",        text: "Hi Budi! Welcome to the interview for the Senior Frontend Engineer position. Let's start — can you walk me through your experience with React and how you've used it in production?" },
  { turn: 2, speaker: "candidate", text: "Sure! I've been working with React for about 5 years. Most recently, I led the frontend for a large e-commerce platform where we migrated from a class-based architecture to hooks, implemented code splitting to reduce our initial bundle size by 40%, and adopted Redux Toolkit for state management across 20+ feature teams." },
  { turn: 3, speaker: "ai",        text: "That's impressive. Can you tell me more about the code splitting strategy you used? How did you decide what to split?" },
  { turn: 4, speaker: "candidate", text: "We used React.lazy and Suspense for route-level splitting as a baseline. Then we profiled the bundle with webpack-bundle-analyzer and identified heavy vendor libraries — like a rich text editor — that were only needed on specific pages, so we lazy-loaded those too. We also introduced import() with prefetch hints for pages users were likely to visit next, which improved perceived performance significantly." },
  { turn: 5, speaker: "ai",        text: "Great answer. Let's shift to TypeScript. How would you type a generic API response wrapper that can hold any data type but always includes a status code and optional error message?" },
  { turn: 6, speaker: "candidate", text: "I'd use a generic interface like: interface ApiResponse<T> { status: number; data?: T; error?: string; }. This keeps it flexible — you can narrow T at the call site, like ApiResponse<User[]>, and TypeScript will enforce the shape throughout. I'd also add a type guard like isSuccess to help narrow the union at runtime." },
  { turn: 7, speaker: "ai",        text: "Excellent. Last area — communication. Can you describe a situation where you had to explain a complex technical decision to a non-technical stakeholder?" },
  { turn: 8, speaker: "candidate", text: "Yes, we decided to delay a feature to pay down significant technical debt in our data fetching layer. I prepared a one-pager comparing two options — quick fix vs. proper refactor — with projected timelines and risk of each. I focused on business outcomes: the quick fix would likely cause 2-3 more production incidents per quarter, each costing roughly 4 hours of eng time. The stakeholder approved the refactor after that." },
].freeze

TRANSCRIPT.each do |t|
  turn = TranscriptTurn.find_or_initialize_by(session_id: session.id, turn_number: t[:turn])
  if turn.new_record?
    turn.assign_attributes(speaker: t[:speaker], text: t[:text])
    turn.save!
    puts "  Created turn ##{t[:turn]} (#{t[:speaker]})"
  else
    puts "  Turn ##{t[:turn]} already exists (skipped)"
  end
end

# ── Coverage Maps ─────────────────────────────────────────────────────────────
puts ""
puts "== Seeding Coverage Maps =="

COVERAGE_MAP_DEFS = [
  { skill_id: "SK-ENG-001", skill_label: "React / Frontend Development Core", state: "covered",   probe_count: 4, last_signal: "Candidate demonstrated advanced knowledge of hooks, performance optimization, and code splitting." },
  { skill_id: "SK-ENG-009", skill_label: "TypeScript & Type Systems",          state: "covered",   probe_count: 2, last_signal: "Candidate correctly typed a generic API wrapper with type guards." },
  { skill_id: "SK-ENG-003", skill_label: "System Design & Architecture",       state: "partial",   probe_count: 1, last_signal: "Mentioned bundle optimization but didn't discuss broader system design." },
  { skill_id: "SK-ENG-006", skill_label: "Testing & Quality Assurance",        state: "not_yet",   probe_count: 0, last_signal: nil },
  { skill_id: "SK-SOFT-001", skill_label: "Communication",                     state: "covered",   probe_count: 2, last_signal: "Candidate clearly explained technical trade-offs to a non-technical stakeholder using business impact framing." },
].freeze

COVERAGE_MAP_DEFS.each do |defn|
  cm = CoverageMap.find_or_initialize_by(session_id: session.id, skill_label: defn[:skill_label])
  if cm.new_record?
    cm.assign_attributes(
      skill_id:    defn[:skill_id],
      state:       defn[:state],
      probe_count: defn[:probe_count],
      last_signal: defn[:last_signal]
    )
    cm.save!
    puts "  Created coverage map: #{defn[:skill_label]} → #{defn[:state]}"
  else
    puts "  Coverage map already exists: #{defn[:skill_label]} (skipped)"
  end
end

# ── Vacancy ───────────────────────────────────────────────────────────────────
puts ""
puts "== Seeding Vacancy =="

vacancy = Vacancy.find_or_initialize_by(
  tenant_id:  org_id,
  role_title: "Senior Frontend Engineer"
)

if vacancy.new_record?
  vacancy.assign_attributes(
    created_by: admin_user.id,
    culture_dimensions: <<~TEXT.strip,
      We value engineers who take strong ownership of their work, communicate proactively with stakeholders,
      and care deeply about end-user experience. We expect candidates to balance speed with quality,
      and to bring a growth mindset to every challenge.
    TEXT
    competency_expectations: <<~TEXT.strip
      The ideal candidate has 4+ years of experience with React in production, is comfortable with TypeScript
      at an advanced level, and can design scalable frontend architectures. Strong communication skills are
      essential as this role works closely with product managers and designers.
    TEXT
  )
  vacancy.save!
  puts "  Created vacancy: id=#{vacancy.id} role=#{vacancy.role_title}"
else
  puts "  Vacancy already exists: id=#{vacancy.id} (skipped)"
end

# ── Vacancy Skills ────────────────────────────────────────────────────────────
puts ""
puts "== Seeding Vacancy Skills =="

VACANCY_SKILL_DEFS = [
  { skill_id: "SK-ENG-001", skill_label: "React / Frontend Development Core", expected_level: 4 },
  { skill_id: "SK-ENG-009", skill_label: "TypeScript & Type Systems",          expected_level: 4 },
  { skill_id: "SK-ENG-003", skill_label: "System Design & Architecture",       expected_level: 3 },
  { skill_id: "SK-ENG-006", skill_label: "Testing & Quality Assurance",        expected_level: 3 },
  { skill_id: "SK-SOFT-001", skill_label: "Communication",                     expected_level: 3 },
].freeze

VACANCY_SKILL_DEFS.each do |defn|
  vs = VacancySkill.find_or_initialize_by(vacancy_id: vacancy.id, skill_id: defn[:skill_id])
  if vs.new_record?
    vs.assign_attributes(skill_label: defn[:skill_label], expected_level: defn[:expected_level])
    vs.save!
    puts "  Created vacancy skill: #{defn[:skill_id]} — #{defn[:skill_label]} (L#{defn[:expected_level]})"
  else
    puts "  Vacancy skill already exists: #{defn[:skill_id]} (skipped)"
  end
end

# ── Portfolio ─────────────────────────────────────────────────────────────────
puts ""
puts "== Seeding Portfolio =="

portfolio = Portfolio.find_or_initialize_by(session_id: session.id)

if portfolio.new_record?
  portfolio.assign_attributes(
    candidate_id:      candidate_user.id,
    generation_status: "complete",
    generated_at:      45.minutes.ago
  )
  portfolio.save!
  puts "  Created portfolio: id=#{portfolio.id} status=#{portfolio.generation_status}"
else
  puts "  Portfolio already exists: id=#{portfolio.id} (skipped)"
end

# ── Portfolio Skills ──────────────────────────────────────────────────────────
puts ""
puts "== Seeding Portfolio Skills =="

PORTFOLIO_SKILL_DEFS = [
  {
    skill_id:          "SK-ENG-001",
    skill_label:       "React / Frontend Development Core",
    is_discovered:     false,
    ai_level:          4,
    ai_confidence:     "high",
    evidence:          [
      "Led migration from class components to hooks across 20+ feature teams.",
      "Reduced initial bundle by 40% using React.lazy, Suspense, and route-level code splitting.",
      "Implemented Redux Toolkit for shared state in a large e-commerce platform."
    ],
    competency_summary: "Candidate demonstrates strong L4 competency in React. They have led architectural migrations at scale, applied advanced performance optimization techniques, and managed complex state across large teams. Suitable for senior/lead roles."
  },
  {
    skill_id:          "SK-ENG-009",
    skill_label:       "TypeScript & Type Systems",
    is_discovered:     false,
    ai_level:          3,
    ai_confidence:     "high",
    evidence:          [
      "Correctly designed a generic ApiResponse<T> wrapper with optional fields.",
      "Mentioned adding type guards (isSuccess) to narrow union types at runtime."
    ],
    competency_summary: "Candidate shows solid L3 TypeScript skills. They can design generic, reusable type abstractions and apply type narrowing in practice. Has not yet demonstrated L4 behaviors such as defining typing standards or leading TS migrations."
  },
  {
    skill_id:          "SK-ENG-003",
    skill_label:       "System Design & Architecture",
    is_discovered:     false,
    ai_level:          2,
    ai_confidence:     "medium",
    evidence:          [
      "Described bundle architecture decisions (code splitting, prefetch hints).",
      "Did not discuss broader system boundaries, inter-service communication, or scalability trade-offs."
    ],
    competency_summary: "Evidence is limited to frontend build optimization. Candidate did not demonstrate full L3 system design (multi-service design, failure modes, scalability). Assessed at L2 with medium confidence — more probing needed."
  },
  {
    skill_id:          "SK-ENG-006",
    skill_label:       "Testing & Quality Assurance",
    is_discovered:     false,
    ai_level:          2,
    ai_confidence:     "low",
    evidence:          [],
    competency_summary: "No explicit evidence gathered for this skill. Session ended before testing could be probed. Defaulting to L2 based on seniority inference only — confidence is low. Recommend assessor override if additional evidence is available."
  },
  {
    skill_id:          "SK-SOFT-001",
    skill_label:       "Communication",
    is_discovered:     false,
    ai_level:          3,
    ai_confidence:     "high",
    evidence:          [
      "Prepared a one-pager comparing technical options framed around business outcomes.",
      "Convinced a non-technical stakeholder to approve a technical debt refactor by quantifying production incident costs."
    ],
    competency_summary: "Candidate demonstrates clear L3 communication. They proactively framed a technical decision using business language, adapted their message to a non-technical audience, and drove stakeholder alignment on a difficult trade-off."
  },
  {
    skill_id:          "SK-ENG-007",
    skill_label:       "DevOps & CI/CD",
    is_discovered:     true,
    ai_level:          2,
    ai_confidence:     "medium",
    evidence:          [
      "Mentioned deploying to staging and production as part of their migration work.",
      "Implied familiarity with webpack build pipeline configuration."
    ],
    competency_summary: "Candidate incidentally revealed basic DevOps familiarity. Not a required skill for this assessment, but may be additive for the role."
  },
].freeze

PORTFOLIO_SKILL_DEFS.each do |defn|
  ps = PortfolioSkill.find_or_initialize_by(
    portfolio_id: portfolio.id,
    skill_label:  defn[:skill_label]
  )

  if ps.new_record?
    ps.assign_attributes(
      skill_id:           defn[:skill_id],
      is_discovered:      defn[:is_discovered],
      ai_level:           defn[:ai_level],
      ai_confidence:      defn[:ai_confidence],
      evidence:           defn[:evidence],
      competency_summary: defn[:competency_summary]
    )
    ps.save!
    puts "  Created portfolio skill: #{defn[:skill_label]} L#{defn[:ai_level]} (#{defn[:ai_confidence]})#{defn[:is_discovered] ? ' [discovered]' : ''}"
  else
    puts "  Portfolio skill already exists: #{defn[:skill_label]} (skipped)"
  end
end

# ── Fit Gap Report ────────────────────────────────────────────────────────────
puts ""
puts "== Seeding Fit Gap Report =="

fit_gap = FitGapReport.find_or_initialize_by(
  portfolio_id: portfolio.id,
  vacancy_id:   vacancy.id
)

if fit_gap.new_record?
  fit_gap.assign_attributes(
    generated_at: 30.minutes.ago,
    skill_comparisons: [
      {
        skill_id:       "SK-ENG-001",
        skill_label:    "React / Frontend Development Core",
        expected_level: 4,
        candidate_level: 4,
        fit_result:     "match",
        summary:        "Candidate fully meets the L4 expectation. Led React migrations at scale, owns performance optimization strategies, and has demonstrated team-level impact."
      },
      {
        skill_id:       "SK-ENG-009",
        skill_label:    "TypeScript & Type Systems",
        expected_level: 4,
        candidate_level: 3,
        fit_result:     "gap",
        summary:        "Candidate is one level below expectation. Solid L3 skills (generics, type guards) but has not yet demonstrated L4 behaviors like defining team-wide standards or leading TS migrations."
      },
      {
        skill_id:       "SK-ENG-003",
        skill_label:    "System Design & Architecture",
        expected_level: 3,
        candidate_level: 2,
        fit_result:     "gap",
        summary:        "Evidence is limited to frontend build decisions. Multi-service system design, failure modes, and scalability trade-offs were not demonstrated. Assessed one level below expectation with medium confidence."
      },
      {
        skill_id:       "SK-ENG-006",
        skill_label:    "Testing & Quality Assurance",
        expected_level: 3,
        candidate_level: 2,
        fit_result:     "gap",
        summary:        "No testing evidence gathered during the session. Assessed at L2 by inference from seniority. Low confidence — assessor override recommended."
      },
      {
        skill_id:       "SK-SOFT-001",
        skill_label:    "Communication",
        expected_level: 3,
        candidate_level: 3,
        fit_result:     "match",
        summary:        "Candidate meets the L3 expectation. Demonstrated clear, audience-adapted communication and successfully drove stakeholder alignment on a complex technical decision."
      }
    ],
    culture_narrative: <<~TEXT.strip,
      Budi demonstrates strong ownership and initiative — hallmarks of the engineering culture at Test Corp.
      The e-commerce migration story shows they can drive large, cross-team changes without being directed,
      which aligns well with our expectation of senior engineers who lead from the front.

      Their communication style is particularly strong: they frame decisions in business terms, prepare
      structured artifacts, and drive stakeholder buy-in proactively. This is exactly the kind of
      cross-functional impact we value.

      The main cultural risk is around quality rigor — we didn't gather testing evidence, and system
      design depth was below expectation. If Test Corp runs a test-first culture, this should be probed
      further before making a hiring decision.
    TEXT
    overall_narrative: <<~TEXT.strip
      Budi is a strong match for the React and communication dimensions of this role, demonstrating
      genuine L4 React expertise and L3 communication skills. However, two notable gaps exist:
      TypeScript is one level below the L4 requirement, and system design evidence is thin.
      Testing could not be assessed.

      Recommendation: Proceed to final round with a focused system design interview and a practical
      TypeScript challenge. If those go well, this candidate is a strong hire for the senior track.
    TEXT
  )
  fit_gap.save!
  puts "  Created fit gap report: id=#{fit_gap.id} for vacancy '\#{vacancy.role_title}'"
else
  puts "  Fit gap report already exists: id=#{fit_gap.id} (skipped)"
end

# ── Print usage instructions ──────────────────────────────────────────────────

puts ""
puts "== Done! =="
puts ""
puts "Seeded data summary:"
puts "  Organization : id=#{org['id']} scheme=#{org['scheme']}"
puts "  Admin user   : id=#{admin_user.id} email=#{admin_user.email}"
puts "  Candidate    : id=#{candidate_user.id} email=#{candidate_user.email}"
puts "  Assessment   : id=#{assessment.id} — #{assessment.name}"
puts "  Session      : id=#{session.id} — #{session.candidate_name} (#{session.status})"
puts "  Vacancy      : id=#{vacancy.id} — #{vacancy.role_title}"
puts "  Portfolio    : id=#{portfolio.id} (#{portfolio.generation_status})"
puts "  Fit/Gap      : id=#{fit_gap.id}"
puts ""
puts "Frontend URLs you can now visit:"
puts "  Assessments  : http://localhost:5173/assessments"
puts "  Assessment   : http://localhost:5173/assessments/#{assessment.id}"
puts "  Session      : http://localhost:5173/assessments/#{assessment.id}/sessions/#{session.id}"
puts "  Portfolio    : http://localhost:5173/assessments/#{assessment.id}/sessions/#{session.id}/portfolio"
puts "  Fit/Gap      : http://localhost:5173/assessments/#{assessment.id}/sessions/#{session.id}/fitgap/#{vacancy.id}"
puts ""
puts "To mint a JWT for testing, open the Rails console:"
puts ""
puts "  bundle exec rails console"
puts ""
puts "Then run:"
puts ""
puts "  # Assessor / admin token (can create assessments, view sessions, etc.)"
puts "  token = JsonWebToken.encode({ user_id: #{admin_user.id}, role: 'admin', scheme: '#{TEST_ORG[:scheme]}' })"
puts "  puts token"
puts ""
puts "  # Candidate token (used in WebSocket ?token= param)"
puts "  token = JsonWebToken.encode({ user_id: #{candidate_user.id}, role: 'student', scheme: '#{TEST_ORG[:scheme]}' })"
puts "  puts token"
puts ""
puts "Then hit the API:"
puts ""
puts "  curl -s http://localhost:3001/api/v1/health"
puts ""
puts "  curl -s -H 'Authorization: Bearer <your_token>' \\"
puts "       http://localhost:3001/api/v1/assessments"
puts ""
