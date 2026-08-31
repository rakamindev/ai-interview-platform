const MOCK_SKILL_TAXONOMIES = {
    skill_taxonomies: [
        {
            skill_id: "SK-ENG-001",
            skill_label: "React / Frontend Development Core",
            category: "engineering",
            scope_include:
                "Component design, state management (Redux/Context), hooks, performance optimization, code splitting, testing (Jest/RTL)",
            scope_exclude:
                "Backend APIs, mobile (React Native), non-React frameworks",
            l1_anchor:
                "Implements components from specs with close review. Understands JSX and basic hooks (useState, useEffect).",
            l2_anchor:
                "Builds routine features independently. Uses Context or Redux for shared state. Writes basic unit tests.",
            l3_anchor:
                "Designs and builds complex features end-to-end. Optimizes rendering (memoization, code splitting). Owns test strategy for their area.",
            l4_anchor:
                "Defines frontend standards for the team. Leads architecture decisions (state strategy, folder structure, build pipeline).",
            l5_anchor:
                "Defines frontend architecture strategy for the org. Drives cross-team adoption of patterns. Innovates on DX and performance at scale.",
        },
        {
            skill_id: "SK-ENG-002",
            skill_label: "Node.js / Backend Development",
            category: "engineering",
            scope_include:
                "REST API design, Express/Fastify, async patterns, middleware, error handling, background jobs",
            scope_exclude: "Frontend, mobile, non-Node runtimes (Ruby, Python)",
            l1_anchor:
                "Implements endpoints from spec with guidance. Understands request/response cycle and basic async (async/await).",
            l2_anchor:
                "Builds CRUD APIs independently. Handles validation, error middleware, and basic auth patterns.",
            l3_anchor:
                "Designs service boundaries and data flow. Implements background jobs, caching strategies, and structured logging.",
            l4_anchor:
                "Defines API standards across services. Leads decisions on runtime patterns, observability, and service resilience.",
            l5_anchor:
                "Owns backend platform strategy. Drives decisions on runtime selection, distributed system patterns, and org-wide reliability targets.",
        },
        {
            skill_id: "SK-ENG-003",
            skill_label: "System Design & Architecture",
            category: "engineering",
            scope_include:
                "Distributed systems, scalability, trade-off analysis, component boundaries, data flow, reliability patterns",
            scope_exclude: "Low-level hardware, network infrastructure design",
            l1_anchor:
                "Understands basic client-server model. Can explain what a database, API, and frontend are and how they connect.",
            l2_anchor:
                "Designs simple systems (single service + DB). Identifies obvious bottlenecks and applies common patterns (caching, queues).",
            l3_anchor:
                "Designs multi-service systems with clear trade-offs. Considers failure modes, scaling strategies, and data consistency.",
            l4_anchor:
                "Leads architecture decisions for complex systems. Defines standards for reliability, observability, and inter-service communication.",
            l5_anchor:
                "Shapes org-wide technical architecture. Evaluates build vs. buy, platform choices, and long-term scalability bets.",
        },
        {
            skill_id: "SK-ENG-004",
            skill_label: "Database Design & SQL",
            category: "engineering",
            scope_include:
                "Schema design, normalization, indexing, query optimization, migrations, transactions, PostgreSQL/MySQL",
            scope_exclude:
                "NoSQL (covered separately), data warehousing, BI tools",
            l1_anchor:
                "Writes basic SELECT queries. Understands tables, columns, and primary keys.",
            l2_anchor:
                "Writes JOINs and aggregations. Designs simple schemas with foreign keys. Runs migrations safely.",
            l3_anchor:
                "Optimizes slow queries (EXPLAIN, indexing). Designs schemas for performance and correctness. Handles transactions and locking.",
            l4_anchor:
                "Defines DB standards for the team. Reviews schema changes for production impact. Leads partitioning and replication decisions.",
            l5_anchor:
                "Owns database strategy at org level. Evaluates DB technology choices, sets reliability and scaling targets, guides DBA practice.",
        },
        {
            skill_id: "SK-ENG-005",
            skill_label: "RESTful API Design",
            category: "engineering",
            scope_include:
                "Resource modeling, HTTP semantics, versioning, auth patterns, pagination, error contracts, OpenAPI/Swagger",
            scope_exclude: "GraphQL, gRPC, frontend consumption",
            l1_anchor:
                "Implements endpoints following an existing spec. Understands HTTP methods and status codes.",
            l2_anchor:
                "Designs simple CRUD APIs. Applies REST conventions (nouns, status codes, auth headers). Documents with OpenAPI.",
            l3_anchor:
                "Designs APIs with clear versioning, pagination, and error contracts. Balances flexibility and backward compatibility.",
            l4_anchor:
                "Defines API standards across teams. Reviews contracts for consistency and breaking-change risk.",
            l5_anchor:
                "Drives API platform strategy. Establishes org-wide contracts, deprecation policies, and developer experience standards.",
        },
        {
            skill_id: "SK-ENG-006",
            skill_label: "Testing & Quality Assurance",
            category: "engineering",
            scope_include:
                "Unit tests, integration tests, E2E tests, TDD, test strategy, CI test pipelines, test coverage",
            scope_exclude:
                "Manual QA processes, load testing (covered in performance), security testing",
            l1_anchor:
                "Writes basic unit tests with guidance. Understands what a test is and why it matters.",
            l2_anchor:
                "Writes unit and integration tests independently. Maintains test coverage for own code. Fixes flaky tests.",
            l3_anchor:
                "Defines test strategy for a feature area. Writes E2E tests. Improves CI pipeline reliability. Advocates for test quality in reviews.",
            l4_anchor:
                "Defines testing standards for the team. Leads adoption of testing practices (TDD, contract testing). Manages coverage targets.",
            l5_anchor:
                "Owns quality engineering strategy. Drives org-wide shift in testing culture and tooling investment.",
        },
        {
            skill_id: "SK-ENG-007",
            skill_label: "DevOps & CI/CD",
            category: "engineering",
            scope_include:
                "CI/CD pipelines, Docker, deployment automation, environment management, monitoring basics, incident response",
            scope_exclude:
                "Cloud infrastructure provisioning (SK-ENG-008), security hardening",
            l1_anchor:
                "Understands what CI/CD does. Can read a pipeline config and debug a failed build with guidance.",
            l2_anchor:
                "Maintains and extends existing pipelines. Dockerizes services. Deploys to staging/production following runbooks.",
            l3_anchor:
                "Designs CI/CD pipelines from scratch. Implements blue/green or canary deployments. Defines rollback procedures.",
            l4_anchor:
                "Leads DevOps standards for the team. Improves deployment frequency and MTTR. Drives shift-left on reliability.",
            l5_anchor:
                "Owns deployment platform strategy. Sets org-wide targets for deploy frequency, lead time, and change failure rate (DORA metrics).",
        },
        {
            skill_id: "SK-ENG-008",
            skill_label: "Cloud Infrastructure (AWS / GCP / Azure)",
            category: "engineering",
            scope_include:
                "Compute (EC2/GCE/VMs), managed services (RDS, S3, Pub/Sub), IaC (Terraform/CDK), networking basics, cost management",
            scope_exclude:
                "On-premise infrastructure, specialized ML platforms",
            l1_anchor:
                "Uses cloud console to view resources. Understands what a VM, object storage, and managed DB are.",
            l2_anchor:
                "Provisions and configures basic cloud resources. Uses IaC templates written by others. Monitors costs and alerts.",
            l3_anchor:
                "Designs cloud architectures for reliability and cost-efficiency. Writes IaC modules. Leads incident response for cloud services.",
            l4_anchor:
                "Defines cloud standards for the team. Reviews architecture for security and cost. Drives FinOps practices.",
            l5_anchor:
                "Owns cloud platform strategy. Evaluates multi-cloud trade-offs. Sets org-level reliability, security, and cost targets.",
        },
        {
            skill_id: "SK-ENG-009",
            skill_label: "TypeScript & Type Systems",
            category: "engineering",
            scope_include:
                "Static typing, generics, utility types, type narrowing, TypeScript config, type-safe API contracts",
            scope_exclude: "JavaScript fundamentals, other typed languages",
            l1_anchor:
                "Adds basic type annotations with guidance. Understands the difference between typed and untyped code.",
            l2_anchor:
                "Types own code consistently. Uses interfaces, enums, and basic generics. Fixes type errors independently.",
            l3_anchor:
                "Designs type-safe abstractions (generics, mapped types, conditional types). Improves type coverage across a codebase.",
            l4_anchor:
                "Defines typing standards for the team. Reviews PRs for type safety. Leads migration from JS to TS.",
            l5_anchor:
                "Shapes type system strategy at org level. Drives adoption, tooling investment, and cross-team type contract standards.",
        },
        {
            skill_id: "SK-ENG-010",
            skill_label: "Security Engineering",
            category: "engineering",
            scope_include:
                "OWASP Top 10, auth/authz patterns, secret management, dependency scanning, secure code review",
            scope_exclude:
                "Penetration testing, network security, physical security",
            l1_anchor:
                "Aware of common vulnerabilities (XSS, SQL injection). Follows secure coding guidelines with oversight.",
            l2_anchor:
                "Applies secure defaults independently (input validation, parameterized queries, secret management). Participates in security reviews.",
            l3_anchor:
                "Leads security reviews for a feature area. Designs auth/authz patterns. Identifies and mitigates OWASP Top 10 risks proactively.",
            l4_anchor:
                "Defines security standards for the team. Drives secure SDLC adoption. Responds to and leads post-mortems on security incidents.",
            l5_anchor:
                "Owns security strategy at org level. Drives threat modeling, compliance readiness, and security culture across engineering.",
        },
        {
            skill_id: "SK-PM-001",
            skill_label: "Product Thinking",
            category: "product_process",
            scope_include:
                "User empathy, outcome vs. output thinking, feature trade-offs, success metrics, working with PMs",
            scope_exclude:
                "Product management as a role, market research, pricing",
            l1_anchor:
                "Builds what is specified. Has limited view beyond own task.",
            l2_anchor:
                "Understands the user problem behind a ticket. Asks why before building. Flags UX concerns.",
            l3_anchor:
                "Actively shapes solutions with product. Proposes simpler alternatives. Defines success metrics for own features.",
            l4_anchor:
                "Drives product direction for a domain. Leads discovery with PMs. Connects technical decisions to user and business outcomes.",
            l5_anchor:
                "Shapes org-level product strategy as a technical leader. Bridges business goals and engineering capabilities at the highest level.",
        },
        {
            skill_id: "SK-PM-002",
            skill_label: "Agile & Scrum Practices",
            category: "product_process",
            scope_include:
                "Sprints, retrospectives, standups, backlog grooming, estimation, iterative delivery",
            scope_exclude: "Formal Scrum Master role, project management tools",
            l1_anchor:
                "Attends ceremonies. Completes assigned tickets. Limited understanding of sprint goals.",
            l2_anchor:
                "Participates actively in ceremonies. Estimates reliably. Updates tickets consistently.",
            l3_anchor:
                "Improves team process. Leads retrospectives. Helps define sprint goals. Identifies and removes blockers early.",
            l4_anchor:
                "Shapes team's agile practice. Drives continuous improvement. Coaches others on effective iteration.",
            l5_anchor:
                "Defines delivery culture at org level. Drives cross-team agile adoption and process evolution.",
        },
        {
            skill_id: "SK-PM-003",
            skill_label: "Data-Driven Decision Making",
            category: "product_process",
            scope_include:
                "Using metrics to guide decisions, A/B testing, instrumentation, interpreting dashboards, avoiding vanity metrics",
            scope_exclude:
                "Data engineering, ML modeling, statistical analysis at research depth",
            l1_anchor:
                "Makes decisions based on intuition or what was asked. Does not instrument features.",
            l2_anchor:
                "Instruments own features. Reviews dashboards. Uses data to validate assumptions when prompted.",
            l3_anchor:
                "Drives instrumentation strategy for a feature area. Designs experiments. Challenges decisions not backed by data.",
            l4_anchor:
                "Defines metrics strategy for the team. Drives data-informed culture. Reviews analytics for correctness and relevance.",
            l5_anchor:
                "Shapes org-level data culture. Defines the company's north star metrics. Drives investment in analytics infrastructure.",
        },
        {
            skill_id: "SK-PM-004",
            skill_label: "Stakeholder Management",
            category: "product_process",
            scope_include:
                "Managing expectations, navigating competing priorities, influencing without authority, executive communication",
            scope_exclude: "Client sales, account management",
            l1_anchor:
                "Works within team scope. Minimal external stakeholder interaction.",
            l2_anchor:
                "Communicates status to direct stakeholders. Manages expectations reactively. Escalates when needed.",
            l3_anchor:
                "Proactively aligns stakeholders on scope, timelines, and trade-offs. Navigates competing priorities diplomatically.",
            l4_anchor:
                "Manages complex stakeholder landscapes across teams. Builds trust with senior leaders. Drives alignment on hard decisions.",
            l5_anchor:
                "Manages exec and board-level stakeholders. Shapes org narrative. Navigates org politics to drive strategic outcomes.",
        },
        {
            skill_id: "SK-PM-005",
            skill_label: "Technical Writing & Documentation",
            category: "product_process",
            scope_include:
                "READMEs, ADRs, runbooks, API docs, design docs, onboarding guides",
            scope_exclude:
                "Marketing content, user-facing copy, formal technical publications",
            l1_anchor:
                "Writes documentation only when required. Quality is minimal and often needs revision.",
            l2_anchor:
                "Documents own work consistently. Writes clear READMEs and code comments. Updates docs when code changes.",
            l3_anchor:
                "Writes design docs and ADRs proactively. Creates runbooks and onboarding guides. Improves existing docs.",
            l4_anchor:
                "Defines documentation standards for the team. Reviews docs for clarity and completeness. Drives documentation culture.",
            l5_anchor:
                "Shapes org-wide documentation strategy. Defines what gets documented, how, and where. Invests in tooling and standards.",
        },
        {
            skill_id: "SK-SOFT-001",
            skill_label: "Communication",
            category: "soft_skills",
            scope_include:
                "Clear technical explanation, stakeholder alignment, async written communication, cross-team alignment, presentation",
            scope_exclude:
                "Public speaking (standalone), marketing communication",
            l1_anchor:
                "Communicates only when asked. Relies on manager to translate technical work to others.",
            l2_anchor:
                "Communicates clearly within the team. Writes adequate tickets and docs. Updates stakeholders reactively.",
            l3_anchor:
                "Communicates proactively across teams. Adapts message to audience (technical vs. non-technical). Facilitates meetings effectively.",
            l4_anchor:
                "Drives alignment across multiple stakeholders. Resolves miscommunication across teams. Models clear communication for others.",
            l5_anchor:
                "Shapes communication culture at org level. Influences executives and external stakeholders. Defines async communication norms.",
        },
        {
            skill_id: "SK-SOFT-002",
            skill_label: "Problem Solving & Analytical Thinking",
            category: "soft_skills",
            scope_include:
                "Root cause analysis, breaking down ambiguous problems, hypothesis-driven thinking, trade-off evaluation",
            scope_exclude:
                "Domain-specific technical problem solving (covered by engineering skills)",
            l1_anchor:
                "Solves well-defined problems with clear guidance. Struggles with ambiguity.",
            l2_anchor:
                "Breaks down defined problems independently. Identifies root causes for familiar issues. Asks good clarifying questions.",
            l3_anchor:
                "Navigates ambiguous problems. Forms and tests hypotheses. Evaluates trade-offs with data. Solves novel problems end-to-end.",
            l4_anchor:
                "Frames complex, multi-dimensional problems for the team. Teaches structured problem-solving approaches.",
            l5_anchor:
                "Applies first-principles thinking to org-level challenges. Shapes how the org approaches hard, undefined problems.",
        },
        {
            skill_id: "SK-SOFT-003",
            skill_label: "Collaboration & Teamwork",
            category: "soft_skills",
            scope_include:
                "Working with peers, cross-functional collaboration, giving/receiving feedback, pair programming, shared ownership",
            scope_exclude:
                "Leadership/management (SK-SOFT-004), conflict resolution (SK-SOFT-007)",
            l1_anchor:
                "Completes assigned work. Participates when asked. Needs prompting to collaborate.",
            l2_anchor:
                "Collaborates reliably within the team. Gives and receives feedback constructively. Proactively asks for help.",
            l3_anchor:
                "Actively builds cross-functional relationships. Unblocks others. Takes shared ownership of team outcomes beyond own tasks.",
            l4_anchor:
                "Elevates team collaboration. Creates rituals and structures that improve how the team works together.",
            l5_anchor:
                "Shapes collaboration culture across the org. Drives cross-team initiatives. Models and teaches high-trust collaboration.",
        },
        {
            skill_id: "SK-SOFT-004",
            skill_label: "Leadership & Ownership",
            category: "soft_skills",
            scope_include:
                "Taking initiative, driving outcomes without authority, accountability, decision-making, inspiring others",
            scope_exclude: "People management, formal authority",
            l1_anchor:
                "Executes tasks assigned. Escalates blockers rather than resolving them. Ownership is limited to own output.",
            l2_anchor:
                "Takes ownership of own tasks end-to-end. Raises issues proactively. Shows initiative on small improvements.",
            l3_anchor:
                "Drives outcomes for a feature or project without being told. Makes decisions within scope. Holds self and peers accountable.",
            l4_anchor:
                "Leads multi-person efforts. Inspires ownership in others. Makes hard calls and owns outcomes when things go wrong.",
            l5_anchor:
                "Drives org-level initiatives. Shapes culture of ownership. Leads through influence across the org.",
        },
        {
            skill_id: "SK-SOFT-005",
            skill_label: "Adaptability & Learning Agility",
            category: "soft_skills",
            scope_include:
                "Picking up new skills, handling change, recovering from failure, intellectual curiosity, growth mindset",
            scope_exclude:
                "Technical upskilling in a specific domain (covered by engineering skills)",
            l1_anchor:
                "Learns within a familiar context. Needs significant support when requirements or tools change.",
            l2_anchor:
                "Adapts to changing requirements with some support. Learns new tools or patterns within a project.",
            l3_anchor:
                "Picks up unfamiliar domains quickly and independently. Thrives in ambiguity. Iterates fast from failure.",
            l4_anchor:
                "Leads the team through major changes (tech pivots, reorgs). Models learning agility for others.",
            l5_anchor:
                "Shapes org's learning culture. Drives continuous adaptation to market and technology shifts at a strategic level.",
        },
        {
            skill_id: "SK-SOFT-006",
            skill_label: "Time Management & Prioritization",
            category: "soft_skills",
            scope_include:
                "Managing own workload, prioritizing under constraints, estimating effort, handling competing demands",
            scope_exclude:
                "Project management tooling, team-level planning (SK-PM-002)",
            l1_anchor:
                "Needs manager to prioritize work. Often misses estimates or context-switches poorly.",
            l2_anchor:
                "Manages own task list. Meets most deadlines. Flags conflicts early. Improves estimates over time.",
            l3_anchor:
                "Prioritizes effectively under competing demands. Makes explicit trade-offs. Protects time for high-impact work.",
            l4_anchor:
                "Helps team prioritize. Eliminates low-value work. Designs processes that improve team throughput.",
            l5_anchor:
                "Shapes org-level prioritization frameworks. Aligns resource allocation to strategic goals.",
        },
        {
            skill_id: "SK-SOFT-007",
            skill_label: "Mentoring & Knowledge Sharing",
            category: "soft_skills",
            scope_include:
                "1:1 mentoring, code reviews as teaching, documentation, tech talks, onboarding, growing others",
            scope_exclude: "People management, performance reviews",
            l1_anchor:
                "Absorbs knowledge from others. Does not yet share knowledge proactively.",
            l2_anchor:
                "Answers questions when asked. Writes basic documentation. Gives feedback in code reviews.",
            l3_anchor:
                "Proactively mentors junior engineers. Runs knowledge-sharing sessions. Creates onboarding resources.",
            l4_anchor:
                "Builds a culture of learning in the team. Designs mentoring programs. Elevates multiple engineers simultaneously.",
            l5_anchor:
                "Shapes learning and knowledge culture org-wide. Invests in platforms and programs that scale knowledge transfer.",
        },
    ],
};

export default MOCK_SKILL_TAXONOMIES;
