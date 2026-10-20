# frozen_string_literal: true

namespace :demo do
  desc 'Create a synthetic interview that ended early, for reviewing the portfolio and fit/gap screens'
  task seed: :environment do
    organization = Organization.find_by!(scheme: ENV.fetch('DEMO_SCHEME', 'test-corp'))
    RequestStore.store[:tenant_id] = organization.id
    Current.tenant_id = organization.id

    skills = {
      'API Design'        => 3,
      'PostgreSQL'        => 3,
      'Testing'           => 3,
      'System Design'     => 3,
      'Incident Response' => 2
    }

    assessment = Assessment.create!(name: 'Backend Engineer (demo)', time_limit_min: 30, created_by: 1)
    skills.each_with_index do |(label, level), index|
      assessment.assessment_skills.create!(
        skill_label: label, expected_level: level, display_order: index,
        l1_anchor: 'Needs close guidance', l2_anchor: 'Independent on routine scope',
        l3_anchor: 'Handles ambiguous scope and trade-offs', l4_anchor: 'Sets team standards',
        l5_anchor: 'Shapes the practice across the org'
      )
    end

    session = assessment.sessions.create!(
      candidate_name: 'Andi Saputra (synthetic)', status: 'ended', end_reason: 'time_ceiling',
      started_at: 32.minutes.ago, ended_at: 2.minutes.ago, duration_seconds: 1_800
    )

    coverage = {
      'API Design'        => ['covered', 4],
      'PostgreSQL'        => ['partial', 2],
      'Testing'           => ['initiated', 1],
      'System Design'     => ['not_yet', 0],
      'Incident Response' => ['not_yet', 0]
    }
    coverage.each do |label, (state, probes)|
      session.coverage_maps.create!(skill_label: label, state: state, probe_count: probes)
    end
    session.coverage_maps.create!(skill_label: 'Kubernetes', is_discovered: true, state: 'initiated', probe_count: 1)

    session.transcript_turns.create!(turn_number: 1, speaker: 'ai', text: 'Walk me through an API you designed.')
    session.transcript_turns.create!(turn_number: 2, speaker: 'candidate', text: 'I versioned the orders API by resource.')

    long_quote = 'We kept v1 of the orders endpoint alive for six months while partners migrated, and every breaking ' \
                 'change went behind a new media type so old clients kept working. I wrote the deprecation policy, ' \
                 'added sunset headers, and we tracked remaining v1 traffic per partner on a dashboard until it reached zero.'

    model_output = {
      'skills' => [
        { 'skill_label' => 'API Design', 'level' => 3,
          'evidence' => [long_quote, 'Idempotency keys on every POST that moves money.'],
          'competency_summary' => 'Designs APIs around client migration paths and failure modes, with clear trade-offs.' },
        { 'skill_label' => 'PostgreSQL', 'level' => 2,
          'evidence' => ['I added a partial index after reading the query plan.'],
          'competency_summary' => 'Comfortable with indexing and query plans on routine problems.' },
        { 'skill_label' => 'Testing', 'level' => nil, 'evidence' => [],
          'competency_summary' => 'Mentioned unit tests once before time ran out. Strategy and depth are unknown.' },
        { 'skill_label' => 'Kubernetes', 'level' => 2,
          'evidence' => ['We ran the workers as a separate deployment.'],
          'competency_summary' => 'Hands-on deployment experience, briefly explored.' }
      ]
    }

    fake_model = Object.new
    fake_model.define_singleton_method(:generate_content) { |*_args, **_opts| model_output }
    portfolio = Portfolios::Generator.new(session: session, gemini_client: fake_model).call

    postgres = portfolio.portfolio_skills.find_by!(skill_label: 'PostgreSQL')
    postgres.create_assessor_override!(ai_level: postgres.ai_level, override_level: 3, overridden_by: 1,
                                       assessor_notes: 'Follow-up call covered replication and lock contention well.')

    vacancy = Vacancy.create!(role_title: 'Senior Backend Engineer (demo)', created_by: 1)
    skills.except('Incident Response').merge('Observability' => 2).each do |label, level|
      vacancy.vacancy_skills.create!(skill_label: label, expected_level: level)
    end

    puts "Portfolio: /assessments/#{assessment.id}/sessions/#{session.id}/portfolio"
    puts "Fit/gap:   /assessments/#{assessment.id}/sessions/#{session.id}/fitgap/#{vacancy.id}"
  end
end
