# frozen_string_literal: true

# Deterministic demo data covering every portfolio and fit/gap state, with no Gemini calls.
# All names and interview content are fictional.
#
#   bundle exec rails demo:seed_report
#
# Re-running replaces the previous demo records (everything named "Demo · …").
namespace :demo do
  desc 'Seed fictional sessions covering every portfolio and fit/gap state'
  task seed_report: :environment do
    DemoReportSeed.new.call
  end
end

class DemoReportSeed
  PREFIX = 'Demo · '
  SKILLS = {
    'SK-ENG-001' => 3, # React / Frontend Development Core
    'SK-ENG-005' => 3, # RESTful API Design
    'SK-ENG-009' => 2, # TypeScript & Type Systems
    'SK-ENG-008' => 2  # Cloud Infrastructure (AWS / GCP / Azure)
  }.freeze

  LONG_SUMMARY = 'Explains component boundaries in terms of ownership of state rather than file layout, and ' \
                 'consistently models loading, empty, error and partial states before writing the happy path. ' \
                 'Described migrating a dashboard from prop drilling to a store with selectors, measured the ' \
                 'render count before and after, and rolled the change out behind a flag. The ceiling shows when ' \
                 'discussing server components: answers stayed at the level of documentation rather than ' \
                 'first-hand trade-offs. Would benefit from ownership of a performance budget across a team. ' * 2

  # Stands in for Gemini when fit/gap narratives are generated for sufficient-evidence reports.
  class NarrativeClient
    def generate_content(_prompt, temperature: 0.4)
      {
        'culture_narrative' => 'Comfortable working asynchronously and explaining trade-offs in writing, which fits ' \
                               'the team\'s written-first culture.',
        'overall_narrative' => 'Meets or exceeds every required level with evidence from the interview. Recommend ' \
                               'proceeding to the technical deep-dive round.'
      }
    end
  end

  def call
    @org = Organization.find_by!(scheme: 'test-corp')
    ActiveRecord::Base.transaction do
      cleanup
      seed
    end
    print_summary
  end

  private

  def cleanup
    demo_sessions = Session.unscoped.joins(:assessment).where('assessments.name LIKE ?', "#{PREFIX}%")
    # Portfolio has no dependent: :destroy for fit/gap reports (logged under F-014), so delete them first.
    FitGapReport.where(portfolio_id: Portfolio.where(session_id: demo_sessions.select(:id)).select(:id)).delete_all
    demo_sessions.destroy_all
    Assessment.unscoped.where('name LIKE ?', "#{PREFIX}%").destroy_all
    Vacancy.unscoped.where('role_title LIKE ?', "#{PREFIX}%").destroy_all
  end

  def seed
    taxonomy = SkillTaxonomy.where(skill_id: SKILLS.keys).index_by(&:skill_id)
    @assessment = Assessment.create!(
      tenant_id: @org.id, created_by: 1, name: "#{PREFIX}Frontend Engineer", time_limit_min: 30, language: 'en',
      assessment_skills_attributes: SKILLS.keys.each_with_index.map do |id, i|
        t = taxonomy.fetch(id)
        { skill_id: t.skill_id, skill_label: t.skill_label, display_order: i,
          l1_anchor: t.l1_anchor, l2_anchor: t.l2_anchor, l3_anchor: t.l3_anchor,
          l4_anchor: t.l4_anchor, l5_anchor: t.l5_anchor }
      end
    )
    @labels = @assessment.assessment_skills.order(:display_order).pluck(:skill_label)

    @vacancy = Vacancy.create!(
      tenant_id: @org.id, created_by: 1, role_title: "#{PREFIX}Frontend Engineer (Mid)",
      culture_dimensions: 'Written-first, async collaboration, direct feedback',
      competency_expectations: 'Builds reliable UIs on top of REST APIs',
      vacancy_skills_attributes: SKILLS.each_with_index.map { |(id, level), i| { skill_id: id, skill_label: @labels[i], expected_level: level } }
    )
    @empty_vacancy = Vacancy.create!(tenant_id: @org.id, created_by: 1, role_title: "#{PREFIX}Vacancy without skills")

    @sessions = {
      mixed:        seed_mixed,
      evidenced:    seed_evidenced,
      none:         seed_none_assessed,
      generating:   seed_portfolio_state('Rina', 'generating', 'Rate limited'),
      failed:       seed_portfolio_state('Sari', 'failed', 'Failed after 3 retries: Rate limited'),
      in_progress:  create_session('Tono', status: 'active', ended: false)
    }
  end

  # Partial evidence: one strong, one moderate, one low-confidence, one never discussed, one discovered.
  def seed_mixed
    session = create_session('Andi')
    portfolio = create_portfolio(session, [
      rated(@labels[0], 3, 'high', LONG_SUMMARY, [
        'I always model loading, empty and error states first, then the happy path, because the happy path is the ' \
        'state users see least on a bad connection.',
        'We moved the dashboard to selectors and cut re-renders by roughly half; I measured it with the profiler ' \
        'before and after.',
        'For forms I keep server errors next to the field they belong to, never only in a toast.'
      ]),
      rated(@labels[1], 2, 'medium', 'Uses standard REST conventions and status codes; pagination and idempotency ' \
                                     'were described only when prompted.', ['We return 422 with field errors so the form can show them inline.']),
      rated(@labels[2], 1, 'low', 'Mentioned using TypeScript but gave one short answer.', ['I use TypeScript for props, mostly.']),
      not_assessed(@labels[3], 'Not covered: the candidate did not discuss cloud or deployment work.'),
      rated('Accessibility', 2, 'medium', 'Brought up keyboard navigation and labels unprompted.',
            ['I check every new component with the keyboard only before I open the PR.'], discovered: true)
    ])
    fit_gap(portfolio, @vacancy)
    fit_gap(portfolio, @empty_vacancy)
    session
  end

  # Every required skill evidenced, one assessor override: the recommendation is allowed.
  def seed_evidenced
    session = create_session('Budi')
    portfolio = create_portfolio(session, [
      rated(@labels[0], 3, 'high', 'Strong component design and state modelling.', ['I split state by who owns it, not by where it is rendered.']),
      rated(@labels[1], 3, 'high', 'Designs resource-oriented APIs with clear error contracts.', ['Every list endpoint is cursor-paginated so retries are safe.']),
      rated(@labels[2], 2, 'medium', 'Uses discriminated unions for API responses.', ['I type the API response as a union of success and error.']),
      rated(@labels[3], 1, 'medium', 'Has deployed with a managed platform; limited infrastructure ownership.', ['We deployed through the platform team\'s pipeline.'])
    ])
    cloud = portfolio.portfolio_skills.find_by!(skill_label: @labels[3])
    AssessorOverride.create!(portfolio_skill: cloud, ai_level: 1, override_level: 2, overridden_by: 1,
                             assessor_notes: 'Follow-up call: owns the staging environment and its Terraform.')
    fit_gap(portfolio, @vacancy)
    session
  end

  # The candidate left after two minutes: nothing to rate.
  def seed_none_assessed
    session = create_session('Citra', end_reason: 'manual_candidate', duration: 128)
    portfolio = create_portfolio(session, @labels.map { |label| not_assessed(label, 'Not covered: the interview ended early.') })
    fit_gap(portfolio, @vacancy)
    session
  end

  def seed_portfolio_state(name, status, error)
    session = create_session(name)
    Portfolio.create!(session: session, generation_status: status, generation_error: error)
    session
  end

  def create_session(name, status: 'ended', ended: true, end_reason: 'time_ceiling', duration: 1_740)
    session = Session.create!(
      tenant_id: @org.id, assessment: @assessment, candidate_name: "#{PREFIX}#{name}", status: status,
      started_at: 1.hour.ago, ended_at: (ended ? 1.hour.ago + duration : nil),
      end_reason: (ended ? end_reason : nil), duration_seconds: (ended ? duration : nil)
    )
    session.transcript_turns.create!(turn_number: 1, speaker: 'ai', text: 'Tell me about a UI you made resilient to a flaky API.')
    session.transcript_turns.create!(turn_number: 2, speaker: 'candidate', text: 'I model loading, empty and error states before the happy path.')
    session
  end

  def create_portfolio(session, skills)
    portfolio = Portfolio.create!(session: session, generation_status: 'complete', generated_at: Time.current)
    skills.each { |attrs| portfolio.portfolio_skills.create!(attrs) }
    portfolio
  end

  def rated(label, level, confidence, summary, evidence, discovered: false)
    { skill_label: label, ai_level: level, ai_confidence: confidence, competency_summary: summary,
      evidence: evidence, is_discovered: discovered }
  end

  def not_assessed(label, summary)
    { skill_label: label, ai_level: nil, ai_confidence: nil, competency_summary: summary, evidence: [] }
  end

  def fit_gap(portfolio, vacancy)
    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: NarrativeClient.new).call
  end

  def print_summary
    base = "http://localhost:5173/assessments/#{@assessment.id}/sessions"
    puts "Demo data for #{@org.scheme} (assessment #{@assessment.id}):"
    @sessions.each do |key, session|
      puts format('  %-12<key>s portfolio: %<base>s/%<id>d/portfolio', key: key, base: base, id: session.id)
    end
    %i[mixed evidenced none].each do |key|
      puts format('  %-12<key>s fit/gap:   %<base>s/%<id>d/fitgap/%<vacancy>d', key: key, base: base, id: @sessions[key].id, vacancy: @vacancy.id)
    end
    puts format('  %-12<key>s fit/gap:   %<base>s/%<id>d/fitgap/%<vacancy>d', key: 'empty_vac', base: base, id: @sessions[:mixed].id, vacancy: @empty_vacancy.id)
  end
end
