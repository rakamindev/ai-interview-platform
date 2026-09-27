# frozen_string_literal: true

namespace :db do
  namespace :seed do
    desc 'Seed idempotent E2E test data for Playwright test suite'
    task e2e: :environment do
      puts '== Seeding E2E Interview Test Data =='

      # ── 1. Organization Setup ──────────────────────────────────────────────────
      org_data = {
        name: 'E2E Corporation',
        scheme: 'e2e-corp',
        identifier: 'e2e-corp',
        host: 'localhost'
      }

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

      org = Organization.find_by(scheme: org_data[:scheme])
      if org.nil?
        result = ActiveRecord::Base.connection.select_one(<<~SQL)
          INSERT INTO public.organizations
            (name, scheme, identifier, host, alias_hosts, config, created_at, updated_at)
          VALUES
            ('#{org_data[:name]}', '#{org_data[:scheme]}', '#{org_data[:identifier]}', '#{org_data[:host]}', '{}', '{}', NOW(), NOW())
          RETURNING id, name, scheme;
        SQL
        org = Organization.find(result['id'])
        puts "  Created organization: id=#{org.id} scheme=#{org.scheme}"
      else
        puts "  Found organization: id=#{org.id} scheme=#{org.scheme}"
      end

      # ── 2. Clear Existing E2E Test Data ───────────────────────────────────────
      e2e_tokens = %w[
        e2e-token-happy-path
        e2e-token-resumption
        e2e-token-consent-decline
        e2e-token-soft-bypass
        e2e-token-live-gemini
        e2e-token-model-validity
      ].freeze

      # Clean up existing vacancies and fit-gap reports
      tenant_vacancy_ids = Vacancy.unscoped.where(tenant_id: org.id).pluck(:id)
      if tenant_vacancy_ids.any?
        FitGapReport.unscoped.where(vacancy_id: tenant_vacancy_ids).delete_all
        VacancySkill.unscoped.where(vacancy_id: tenant_vacancy_ids).delete_all
        Vacancy.unscoped.where(id: tenant_vacancy_ids).delete_all
      end

      # Clean up sessions and cascading relations
      sessions = Session.unscoped.where(tenant_id: org.id).or(Session.unscoped.where(invite_token: e2e_tokens))
      session_ids = sessions.pluck(:id)

      if session_ids.any?
        portfolio_ids = Portfolio.unscoped.where(session_id: session_ids).pluck(:id)
        if portfolio_ids.any?
          FitGapReport.unscoped.where(portfolio_id: portfolio_ids).delete_all
          portfolio_skill_ids = PortfolioSkill.unscoped.where(portfolio_id: portfolio_ids).pluck(:id)
          AssessorOverride.unscoped.where(portfolio_skill_id: portfolio_skill_ids).delete_all if portfolio_skill_ids.any?
          PortfolioSkill.unscoped.where(portfolio_id: portfolio_ids).delete_all
          Portfolio.unscoped.where(id: portfolio_ids).delete_all
        end

        TranscriptTurn.unscoped.where(session_id: session_ids).delete_all
        CoverageMap.unscoped.where(session_id: session_ids).delete_all
        Session.unscoped.where(id: session_ids).delete_all
      end

      # Clean up assessments and skills
      tenant_assessment_ids = Assessment.unscoped.where(tenant_id: org.id).pluck(:id)
      if tenant_assessment_ids.any?
        AssessmentSkill.unscoped.where(assessment_id: tenant_assessment_ids).delete_all
        Assessment.unscoped.where(id: tenant_assessment_ids).delete_all
      end

      puts "  Cleaned up existing E2E data for tenant #{org.scheme}"

      # ── 3. Seed Skill Taxonomy & Standardized B7 Competencies ─────────────────
      b7_competencies = [
        {
          skill_id: 'SK-ENG-001',
          skill_label: 'React / Frontend Development Core',
          category: 'engineering',
          scope_include: 'Component design, state management (Redux/Context), hooks, performance optimization, code splitting, testing (Jest/RTL)',
          scope_exclude: 'Backend APIs, mobile (React Native), non-React frameworks',
          l1_anchor: 'Implements components from specs with close review. Understands JSX and basic hooks (useState, useEffect).',
          l2_anchor: 'Builds routine features independently. Uses Context or Redux for shared state. Writes basic unit tests.',
          l3_anchor: 'Designs and builds complex features end-to-end. Optimizes rendering (memoization, code splitting). Owns test strategy for their area.',
          l4_anchor: 'Defines frontend standards for the team. Leads architecture decisions (state strategy, folder structure, build pipeline).',
          l5_anchor: 'Defines frontend architecture strategy for the org. Drives cross-team adoption of patterns. Innovates on DX and performance at scale.',
          expected_level: 3
        },
        {
          skill_id: 'SK-ENG-002',
          skill_label: 'Node.js / Backend Development',
          category: 'engineering',
          scope_include: 'REST API design, Express/Fastify, async patterns, middleware, error handling, background jobs',
          scope_exclude: 'Frontend, mobile, non-Node runtimes (Ruby, Python)',
          l1_anchor: 'Implements endpoints from spec with guidance. Understands request/response cycle and basic async (async/await).',
          l2_anchor: 'Builds CRUD APIs independently. Handles validation, error middleware, and basic auth patterns.',
          l3_anchor: 'Designs service boundaries and data flow. Implements background jobs, caching strategies, and structured logging.',
          l4_anchor: 'Defines API standards across services. Leads decisions on runtime patterns, observability, and service resilience.',
          l5_anchor: 'Owns backend platform strategy. Drives decisions on runtime selection, distributed system patterns, and org-wide reliability targets.',
          expected_level: 3
        },
        {
          skill_id: 'SK-ENG-003',
          skill_label: 'System Design & Architecture',
          category: 'engineering',
          scope_include: 'Distributed systems, scalability, trade-off analysis, component boundaries, data flow, reliability patterns',
          scope_exclude: 'Low-level hardware, network infrastructure design',
          l1_anchor: 'Understands basic client-server model. Can explain what a database, API, and frontend are and how they connect.',
          l2_anchor: 'Designs simple systems (single service + DB). Identifies obvious bottlenecks and applies common patterns (caching, queues).',
          l3_anchor: 'Designs multi-service systems with clear trade-offs. Considers failure modes, scaling strategies, and data consistency.',
          l4_anchor: 'Leads architecture decisions for complex systems. Defines standards for reliability, observability, and inter-service communication.',
          l5_anchor: 'Shapes org-wide technical architecture. Evaluates build vs. buy, platform choices, and long-term scalability bets.',
          expected_level: 3
        },
        {
          skill_id: 'SK-SOFT-001',
          skill_label: 'Communication',
          category: 'soft_skills',
          scope_include: 'Clear technical explanation, stakeholder alignment, async written communication, cross-team alignment, presentation',
          scope_exclude: 'Public speaking (standalone), marketing communication',
          l1_anchor: 'Communicates only when asked. Relies on manager to translate technical work to others.',
          l2_anchor: 'Communicates clearly within the team. Writes adequate tickets and docs. Updates stakeholders reactively.',
          l3_anchor: 'Communicates proactively across teams. Adapts message to audience (technical vs. non-technical). Facilitates meetings effectively.',
          l4_anchor: 'Drives alignment across multiple stakeholders. Resolves miscommunication across teams. Models clear communication for others.',
          l5_anchor: 'Shapes communication culture at org level. Influences executives and external stakeholders. Defines async communication norms.',
          expected_level: 3
        },
        {
          skill_id: 'SK-SOFT-002',
          skill_label: 'Problem Solving & Analytical Thinking',
          category: 'soft_skills',
          scope_include: 'Root cause analysis, breaking down ambiguous problems, hypothesis-driven thinking, trade-off evaluation',
          scope_exclude: 'Domain-specific technical problem solving (covered by engineering skills)',
          l1_anchor: 'Solves well-defined problems with clear guidance. Struggles with ambiguity.',
          l2_anchor: 'Breaks down defined problems independently. Identifies root causes for familiar issues. Asks good clarifying questions.',
          l3_anchor: 'Navigates ambiguous problems. Forms and tests hypotheses. Evaluates trade-offs with data. Solves novel problems end-to-end.',
          l4_anchor: 'Frames complex, multi-dimensional problems for the team. Teaches structured problem-solving approaches.',
          l5_anchor: 'Applies first-principles thinking to org-level challenges. Shapes how the org approaches hard, undefined problems.',
          expected_level: 3
        }
      ]

      b7_competencies.each do |attrs|
        taxonomy = SkillTaxonomy.find_or_initialize_by(skill_id: attrs[:skill_id])
        taxonomy.assign_attributes(
          skill_label: attrs[:skill_label],
          category: attrs[:category],
          scope_include: attrs[:scope_include],
          scope_exclude: attrs[:scope_exclude],
          l1_anchor: attrs[:l1_anchor],
          l2_anchor: attrs[:l2_anchor],
          l3_anchor: attrs[:l3_anchor],
          l4_anchor: attrs[:l4_anchor],
          l5_anchor: attrs[:l5_anchor]
        )
        taxonomy.save!
      end

      # ── 4. Create Assessment & Vacancy ─────────────────────────────────────────
      assessment = Assessment.unscoped.create!(
        tenant_id: org.id,
        created_by: 1,
        name: 'Senior Full Stack Engineer (E2E)',
        time_limit_min: 45,
        language: 'id'
      )

      b7_competencies.each_with_index do |attrs, index|
        assessment.assessment_skills.create!(
          skill_id: attrs[:skill_id],
          skill_label: attrs[:skill_label],
          is_custom: false,
          scope_include: attrs[:scope_include],
          scope_exclude: attrs[:scope_exclude],
          l1_anchor: attrs[:l1_anchor],
          l2_anchor: attrs[:l2_anchor],
          l3_anchor: attrs[:l3_anchor],
          l4_anchor: attrs[:l4_anchor],
          l5_anchor: attrs[:l5_anchor],
          expected_level: attrs[:expected_level],
          display_order: index + 1
        )
      end

      # Compile and store system prompt
      system_prompt = Assessments::SystemPromptCompiler.new(assessment).call
      assessment.update_column(:system_prompt, system_prompt)
      puts "  Created assessment: id=#{assessment.id} name='#{assessment.name}' with #{assessment.assessment_skills.count} skills"

      vacancy = Vacancy.unscoped.create!(
        tenant_id: org.id,
        created_by: 1,
        role_title: 'Senior Full Stack Engineer',
        culture_dimensions: 'Fast-paced, ownership, continuous learning',
        competency_expectations: 'Demonstrates strong technical architecture and proactive communication'
      )

      b7_competencies.each do |attrs|
        vacancy.vacancy_skills.create!(
          skill_id: attrs[:skill_id],
          skill_label: attrs[:skill_label],
          expected_level: attrs[:expected_level]
        )
      end
      puts "  Created vacancy: id=#{vacancy.id} role='#{vacancy.role_title}' with #{vacancy.vacancy_skills.count} skills"

      # ── 5. Seed Candidate Sessions with Dedicated Tokens ───────────────────────
      candidate_scenarios = [
        { token: 'e2e-token-happy-path', name: 'Budi Pratama (Happy Path)' },
        { token: 'e2e-token-resumption', name: 'Dewi Lestari (Resumption)' },
        { token: 'e2e-token-consent-decline', name: 'Rian Hidayat (Consent Decline)' },
        { token: 'e2e-token-soft-bypass', name: 'Siti Nurhaliza (Soft Bypass)' },
        { token: 'e2e-token-live-gemini', name: 'Agus Setiawan (Live Gemini)' },
        { token: 'e2e-token-model-validity', name: 'Maya Putri (Model Validity)' }
      ]

      candidate_scenarios.each_with_index do |scenario, idx|
        session = Session.unscoped.create!(
          tenant_id: org.id,
          assessment_id: assessment.id,
          candidate_id: idx + 101,
          candidate_name: scenario[:name],
          invite_token: scenario[:token],
          status: 'pending'
        )
        puts "  Created session: token=#{session.invite_token} id=#{session.id} status=#{session.status}"
      end

      puts '== E2E Test Data Seeding Complete =='
    end
  end
end
