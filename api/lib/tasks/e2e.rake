# frozen_string_literal: true

# Synthetic data for the browser tests and the report's screenshots (web/e2e). One assessment, one vacancy, and a
# session for each state a screen can be in, found by candidate name, so running it twice changes nothing.
# Nothing here calls Gemini: every portfolio and fit/gap report is written as already generated.
namespace :e2e do
  desc 'Create the synthetic assessment, sessions and reports the browser tests read (never in production)'
  task seed: :environment do
    abort 'e2e:seed refuses to run in production' if Rails.env.production?

    scheme = ENV.fetch('E2E_TENANT_SCHEME', 'test-corp')
    org    = Organization.find_by(scheme:) or abort "No organization with scheme #{scheme.inspect}: run db:seed first"

    E2eSeed.new(tenant_id: org.id).call
    puts "e2e:seed done for #{scheme}"
  end
end

class E2eSeed
  ASSESSMENT = 'E2E Senior Frontend Engineer'
  VACANCY    = 'E2E Frontend Engineer'

  SKILLS = [
    { skill_id: 'SK-ENG-001', skill_label: 'React', expected_level: 3 },
    { skill_id: 'SK-SOFT-001', skill_label: 'Communication', expected_level: 3 },
    { skill_id: 'SK-ENG-003', skill_label: 'System Design', expected_level: 2 }
  ].freeze

  ANCHORS = {
    l1_anchor: 'Needs close guidance.', l2_anchor: 'Independent on routine scope.',
    l3_anchor: 'Handles ambiguity and trade-offs.', l4_anchor: 'Sets standards for the team.',
    l5_anchor: 'Shapes practice across the org.'
  }.freeze

  REACT_QUOTE = 'We profiled the list with React DevTools and moved the hot data into useRef, which cut re-renders by half.'

  def initialize(tenant_id:)
    @tenant_id = tenant_id
  end

  def call
    ActiveRecord::Base.transaction do
      assessment = seed_assessment
      vacancy    = seed_vacancy

      mixed = seed_session(assessment, 'E2E Mixed', duration: 6 * 60, end_reason: 'manual_candidate')
      seed_portfolio(mixed, 'complete', [
        rated('React', 'SK-ENG-001', 3, 'high', [REACT_QUOTE], 'Consistent L3 behaviour: measured before optimising.'),
        not_assessed('Communication', 'SK-SOFT-001', 'not_reached'),
        not_assessed('System Design', 'SK-ENG-003', 'insufficient_evidence')
      ])
      seed_fit_gap(mixed.portfolio, vacancy)

      all = seed_session(assessment, 'E2E All assessed', duration: 24 * 60, end_reason: 'time_ceiling')
      seed_portfolio(all, 'complete', [
        rated('React', 'SK-ENG-001', 4, 'high', [REACT_QUOTE], 'Sets the team’s approach to rendering performance.'),
        rated('Communication', 'SK-SOFT-001', 3, 'medium', ['I wrote the migration plan and walked support through it.'],
              'Explains trade-offs to non-engineers.'),
        rated('System Design', 'SK-ENG-003', 2, 'low', [], 'Only briefly explored.')
      ])

      failed = seed_session(assessment, 'E2E Failed', duration: 9 * 60, end_reason: 'manual_assessor')
      seed_portfolio(failed, 'failed', [], error_category: 'model_timeout')

      generating = seed_session(assessment, 'E2E Generating', duration: 12 * 60, end_reason: 'manual_candidate')
      seed_portfolio(generating, 'generating', [])

      long = seed_session(assessment, 'E2E Long text', duration: 18 * 60, end_reason: 'time_ceiling')
      seed_portfolio(long, 'complete', [
        rated('React', 'SK-ENG-001', 3, 'high', [long_quote], long_summary),
        not_assessed('Communication', 'SK-SOFT-001', 'not_reached'),
        not_assessed('System Design', 'SK-ENG-003', 'omitted_by_model')
      ])
    end
  end

  private

  def seed_assessment
    assessment = Assessment.unscoped.find_or_create_by!(tenant_id: @tenant_id, name: ASSESSMENT) do |a|
      a.time_limit_min = 30
      a.language       = 'en'
      a.created_by     = 1
    end
    SKILLS.each_with_index do |skill, i|
      AssessmentSkill.find_or_create_by!(assessment:, skill_label: skill[:skill_label]) do |s|
        s.assign_attributes(skill.merge(ANCHORS).merge(display_order: i))
      end
    end
    assessment
  end

  def seed_vacancy
    vacancy = Vacancy.unscoped.find_or_create_by!(tenant_id: @tenant_id, role_title: VACANCY) { _1.created_by = 1 }
    SKILLS.each do |skill|
      VacancySkill.find_or_create_by!(vacancy:, skill_label: skill[:skill_label]) do |s|
        s.skill_id       = skill[:skill_id]
        s.expected_level = skill[:expected_level]
      end
    end
    vacancy
  end

  def seed_session(assessment, candidate_name, duration:, end_reason:)
    Session.unscoped.find_or_create_by!(tenant_id: @tenant_id, assessment:, candidate_name:) do |s|
      s.status           = 'ended'
      s.end_reason       = end_reason
      s.started_at       = (duration + 3600).seconds.ago
      s.ended_at         = 3600.seconds.ago
      s.duration_seconds = duration
    end
  end

  def seed_portfolio(session, status, skills, error_category: nil)
    return session.portfolio if session.portfolio

    portfolio = session.create_portfolio!(
      generation_status:         status,
      generated_at:              (Time.current if status == 'complete'),
      generation_error_category: error_category,
      generation_error:          (Portfolio.generation_error_message(error_category) if error_category)
    )
    skills.each { portfolio.portfolio_skills.create!(_1.merge(is_discovered: false)) }
    portfolio
  end

  def seed_fit_gap(portfolio, vacancy)
    return if FitGapReport.exists?(portfolio:, vacancy:)

    FitGap::Engine.new(portfolio:, vacancy:, gemini_client: NoNarrative.new).call
  end

  def rated(label, skill_id, level, confidence, evidence, summary)
    { skill_label: label, skill_id:, ai_level: level, ai_confidence: confidence, evidence:,
      competency_summary: summary, not_assessed_reason: nil }
  end

  def not_assessed(label, skill_id, reason)
    { skill_label: label, skill_id:, ai_level: nil, ai_confidence: nil, evidence: [], competency_summary: nil,
      not_assessed_reason: reason }
  end

  def long_quote
    "#{REACT_QUOTE} #{'Then we split the store by route, measured again with the profiler, and kept only the changes that moved the numbers. ' * 4}".strip[0, 500]
  end

  def long_summary
    ('Profiles before optimising, explains each trade-off, and checks the result against the baseline. ' * 25)[0, 2000]
  end

  # The fit/gap engine's own comparison, with its counted fallback narrative instead of a model call.
  class NoNarrative
    def generate_content(*) = raise('no model in e2e:seed')
  end
end
