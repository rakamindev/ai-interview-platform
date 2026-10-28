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
  },

  # ── General Skills ────────────────────────────────────────────────────────────
  {
    skill_id:     "SK-GEN-001",
    skill_label:  "Critical Thinking & Decision Making",
    category:     "general",
    scope_include: "Cognitive bias mitigation, structured decision matrices, second-order thinking, risk assessment",
    scope_exclude: "Impulsive choices",
    l1_anchor: "Evaluates obvious pros and cons when presented with options. Reaches decisions with guidance.",
    l2_anchor: "Applies structured criteria to compare alternatives. Identifies hidden assumptions and failure modes.",
    l3_anchor: "Makes high-quality decisions under incomplete information. Uses second-order thinking.",
    l4_anchor: "Establishes decision-making frameworks for teams. Coaches others on bias reduction.",
    l5_anchor: "Shapes organizational decision governance and risk tolerance for pivotal strategic bets."
  },
  {
    skill_id:     "SK-GEN-002",
    skill_label:  "Customer Empathy & Client Relations",
    category:     "general",
    scope_include: "User interview synthesis, managing client expectations, active listening, turning friction into advocacy",
    scope_exclude: "Cold sales pitching",
    l1_anchor: "Listens respectfully to customer feedback. Escalates user complaints accurately.",
    l2_anchor: "Interacts directly with clients with professional poise. Synthesizes user pain points.",
    l3_anchor: "Proactively identifies unmet customer needs. Translates user feedback into product enhancements.",
    l4_anchor: "Builds strong executive relationships with enterprise clients. Resolves high-risk escalations.",
    l5_anchor: "Champions a relentless customer-obsessed culture across product and engineering."
  },
  {
    skill_id:     "SK-GEN-003",
    skill_label:  "Problem Solving & Troubleshooting",
    category:     "general",
    scope_include: "Root cause analysis, systematic diagnosis, breaking down ambiguity, structured debugging, data-backed solutions",
    scope_exclude: "Superficial patching without diagnosis",
    l1_anchor: "Solves simple, well-defined issues following standard guidance. Escalates blockers early.",
    l2_anchor: "Diagnoses routine problems independently. Breaks down symptoms to locate underlying root causes.",
    l3_anchor: "Tackles ambiguous, multifaceted problems end-to-end. Formulates and tests hypotheses methodically.",
    l4_anchor: "Establishes troubleshooting protocols and frameworks for the team. Prevents recurrence of systemic issues.",
    l5_anchor: "Pioneers organizational problem-solving methodologies for company-critical challenges."
  },
  {
    skill_id:     "SK-GEN-004",
    skill_label:  "Professional Work Ethic & Accountability",
    category:     "general",
    scope_include: "Commitment delivery, taking ownership, deadline discipline, resilience under pressure, proactive follow-through",
    scope_exclude: "Blaming others, passive waiting",
    l1_anchor: "Completes assigned tasks with reminders. Follows established guidelines reliably.",
    l2_anchor: "Consistently meets commitments on time. Takes ownership of mistakes and rectifies them promptly.",
    l3_anchor: "Demonstrates high autonomy and initiative. Anticipates roadblocks and resolves them before impact.",
    l4_anchor: "Sets the benchmark for accountability across the team. Inspires peer commitment and dependability.",
    l5_anchor: "Cultivates an organization-wide culture of integrity, high performance, and relentless execution."
  },
  {
    skill_id:     "SK-GEN-005",
    skill_label:  "Cross-Functional Collaboration & Teamwork",
    category:     "general",
    scope_include: "Inter-department coordination, constructive feedback, empathy, alignment building, collective success",
    scope_exclude: "Siloed working, territorial mindset",
    l1_anchor: "Participates effectively in team discussions. Cooperates on team goals when prompted.",
    l2_anchor: "Proactively shares updates and unblocks colleagues. Gives and receives feedback constructively.",
    l3_anchor: "Bridges cross-functional gaps between technical and business teams. Drives smooth collaborative workflows.",
    l4_anchor: "Fosters psychological safety and cross-squad trust. Resolves inter-team frictions constructively.",
    l5_anchor: "Shapes organizational collaboration standards, breaking down silos across departments."
  },
  {
    skill_id:     "SK-GEN-006",
    skill_label:  "Business Communication & Reporting",
    category:     "general",
    scope_include: "Concise executive briefing, structured written memos, active listening, presentation, data storytelling",
    scope_exclude: "Informal chatter, jargon-heavy vagueness",
    l1_anchor: "Communicates project updates clearly within the direct team. Writes coherent status notes.",
    l2_anchor: "Structures written reports logically. Tailors tone appropriately for internal vs external audiences.",
    l3_anchor: "Delivers compelling business presentations. Synthesizes complex findings into actionable executive summaries.",
    l4_anchor: "Aligns diverse senior stakeholders through persuasive and empathetic communication.",
    l5_anchor: "Directs organizational communication strategy and high-stakes investor/client presentations."
  },
  {
    skill_id:     "SK-GEN-007",
    skill_label:  "Time Management & Prioritization",
    category:     "general",
    scope_include: "Eisenhower matrix, capacity planning, focus management, avoiding context-switching, milestone pacing",
    scope_exclude: "Unchecked procrastination",
    l1_anchor: "Manages daily task list with supervisor guidance. Meets basic deadlines.",
    l2_anchor: "Prioritizes high-impact tasks independently. Flags conflicting deadlines proactively.",
    l3_anchor: "Balances urgent vs important priorities effortlessly. Delivers multiple parallel initiatives on schedule.",
    l4_anchor: "Optimizes workload distribution across team members. Streamlines redundant meetings and bottlenecks.",
    l5_anchor: "Architects org-wide time management and productivity frameworks, maximizing team focus."
  },
  {
    skill_id:     "SK-GEN-008",
    skill_label:  "Adaptability & Continuous Learning",
    category:     "general",
    scope_include: "Growth mindset, rapidly adopting new tools/technologies, thriving in ambiguity, iterating from feedback",
    scope_exclude: "Resistance to process evolution",
    l1_anchor: "Adapts to new tools and processes with training and supportive guidance.",
    l2_anchor: "Quickly learns required tools and frameworks. Embraces procedural adjustments constructively.",
    l3_anchor: "Thrives in fast-paced, ambiguous startup environments. Autonomously upskills in emerging methodologies.",
    l4_anchor: "Guides teams smoothly through organizational changes, role pivots, and strategy adjustments.",
    l5_anchor: "Champions institutional agility and lifelong learning culture across the company."
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

# ── Print usage instructions ──────────────────────────────────────────────────

org = ActiveRecord::Base.connection.select_one(
  "SELECT id, scheme FROM public.organizations WHERE scheme = '#{TEST_ORG[:scheme]}' LIMIT 1"
)

puts ""
puts "== Done! =="
puts ""
puts "Your test organization:"
puts "  id     : #{org['id']}"
puts "  scheme : #{org['scheme']}"
puts ""
puts "To mint a JWT for testing, open the Rails console:"
puts ""
puts "  bundle exec rails console"
puts ""
puts "Then run:"
puts ""
puts "  # Assessor / admin token (can create assessments, view sessions, etc.)"
puts "  token = JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: '#{TEST_ORG[:scheme]}' })"
puts "  puts token"
puts ""
puts "  # Candidate token (used in WebSocket ?token= param)"
puts "  token = JsonWebToken.encode({ user_id: 2, role: 'student', scheme: '#{TEST_ORG[:scheme]}' })"
puts "  puts token"
puts ""
puts "Then hit the API:"
puts ""
puts "  curl -s http://localhost:3001/api/v1/health"
puts ""
puts "  curl -s -H 'Authorization: Bearer <your_token>' \\"
puts "       http://localhost:3001/api/v1/assessments"
puts ""
