# frozen_string_literal: true

# Deterministic demo data for the portfolio page states (screenshots, video, manual QA).
# Uses the real request/generation/override code paths with a canned AI response, so no Gemini call
# and no real personal data: every candidate here is synthetic.
#
#   bin/rails demo:portfolio_states          # creates one demo assessment + a candidate per state
#   bin/rails demo:portfolio_states:clear    # removes it again
namespace :demo do
  DEMO_ASSESSMENT = 'Senior Frontend Engineer (demo)'

  class CannedGemini
    def initialize(response) = @response = response
    def generate_content(*) = @response.respond_to?(:call) ? @response.call : @response
    def last_response_meta = { served_model: 'gemini-3.6-flash', response_id: 'demo' }
  end

  TRANSCRIPT = [
    ['ai', "Thanks for joining. Tell me about the most technically challenging frontend project you've worked on recently."],
    ['candidate', 'I built a live logistics dashboard. Hundreds of updates per second, and keeping React state in sync without slowing the page down was the hard part.'],
    ['ai', 'How were you managing that state, and what was breaking?'],
    ['candidate', 'For a live feed, context gets painful fast. Every update to the value re-renders every consumer.'],
    ['ai', 'What did you change?'],
    ['candidate', 'I moved the feed into a store so components subscribe to just the slice they need, and I batch incoming messages before committing them.'],
    ['ai', 'You mentioned batching. How did you decide the batch window?'],
    ['candidate', 'We measured how late events actually arrived and picked a window around the 95th percentile, then tested a few sizes under load.'],
    ['ai', 'Thank you, that covers what I wanted to explore today.']
  ].freeze

  def demo_output(react_level: 3, with_kafka: true, react_evidence: nil)
    {
      'configured_skills' => [
        { 'skill_id' => 'SK-ENG-001', 'skill_label' => 'React / Frontend Development Core', 'level' => react_level,
          'evidence' => react_evidence || [
            'I moved the feed into a store so components subscribe to just the slice they need',
            'we picked a window around the 95th percentile and tested sizes under load'
          ],
          'competency_summary' => 'Handles high-frequency state updates with deliberate trade-offs.' },
        { 'skill_label' => 'Communication', 'level' => nil, 'evidence' => [], 'competency_summary' => '' }
      ],
      'discovered_skills' => with_kafka ? [
        { 'skill_label' => 'Event streaming (Kafka)', 'level' => 2,
          'evidence' => ['I ran our Kafka cluster and tuned consumer lag myself'],
          'competency_summary' => 'Mentioned event streaming briefly.' }
      ] : []
    }
  end

  def demo_org
    Organization.find_by(scheme: ENV.fetch('DEMO_TENANT_SCHEME', 'test-corp')) or abort('No demo tenant organization found')
  end

  def demo_assessment(org)
    Assessment.unscoped.find_by(tenant_id: org.id, name: DEMO_ASSESSMENT) ||
      Assessment.create!(tenant_id: org.id, created_by: 1, name: DEMO_ASSESSMENT, time_limit_min: 30,
                         system_prompt: 'demo', assessment_skills_attributes: [
                           { skill_id: 'SK-ENG-001', skill_label: 'React / Frontend Development Core', expected_level: 4, display_order: 0,
                             l1_anchor: 'Builds simple components with guidance.', l2_anchor: 'Builds features independently using common patterns.',
                             l3_anchor: 'Handles complex state and performance trade-offs independently.',
                             l4_anchor: 'Sets frontend standards and reusable patterns for a team.', l5_anchor: 'Shapes frontend practice across the organisation.' },
                           { skill_label: 'Communication', expected_level: 3, display_order: 1, is_custom: true,
                             l1_anchor: 'Explains with prompting.', l2_anchor: 'Explains clearly one-to-one.', l3_anchor: 'Aligns teams through clear explanation.',
                             l4_anchor: 'Sets communication norms across teams.', l5_anchor: 'Represents the organisation externally.' }
                         ])
  end

  def interviewed(org, assessment, name)
    session = Session.create!(tenant_id: org.id, assessment: assessment, status: 'active', started_at: 20.minutes.ago,
                              candidate_name: name)
    TRANSCRIPT.each_with_index { |(sp, text), i| session.transcript_turns.create!(turn_number: i + 1, speaker: sp, text: text) }
    session.coverage_maps.create!(skill_id: 'SK-ENG-001', skill_label: 'React / Frontend Development Core', state: 'covered', probe_count: 3)
    session.coverage_maps.create!(skill_label: 'Communication', state: 'initiated', probe_count: 1)
    session.coverage_maps.create!(skill_label: 'Event streaming (Kafka)', is_discovered: true, state: 'initiated', probe_count: 1)
    session.update!(status: 'ended', end_reason: 'all_covered', ended_at: Time.current)
    session.create_portfolio!(generation_status: 'pending')
  end

  def run(portfolio, source, response)
    generation = Portfolios::RequestGeneration.new(portfolio: portfolio, source: source, enqueue: false).call
    Portfolios::Generator.new(generation: generation, gemini_client: CannedGemini.new(response)).call
  rescue Gemini::HttpClient::ApiError
    generation
  end

  def override(portfolio, label, level, notes)
    skill = portfolio.reload.all_portfolio_skills.where(skill_label: label).order(:id).last
    Portfolios::SaveOverride.new(portfolio_skill: skill, override_level: level, assessor_notes: notes, user_id: 1).call
  end

  desc 'Create synthetic candidates showing each portfolio page state'
  task portfolio_states: :environment do
    RequestStore.clear!
    org = demo_org
    assessment = demo_assessment(org)
    made = {}

    p = interviewed(org, assessment, 'Rani Pratama')
    run(p, 'session_end', demo_output); override(p, 'React / Frontend Development Core', 4, 'Stronger than rated on trade-offs')
    made['1 normal report'] = p

    p = interviewed(org, assessment, 'Bima Santoso')
    run(p, 'session_end', demo_output); override(p, 'React / Frontend Development Core', 4, 'Stronger than rated')
    Portfolios::RequestGeneration.new(portfolio: p, source: 'admin_rescore', enqueue: false).call
    made['2 re-scoring in progress'] = p

    p = interviewed(org, assessment, 'Citra Lestari')
    run(p, 'session_end', demo_output)
    run(p, 'admin_rescore', -> { raise Gemini::HttpClient::ApiError.new('API returned 404', status: 404, body: { error: { message: 'Model is not found for API version v1' } }.to_json) })
    made['3 re-score failed (previous kept)'] = p

    p = interviewed(org, assessment, 'Dewi Anggraini')
    gen = Portfolios::RequestGeneration.new(portfolio: p, source: 'session_end', enqueue: false).call
    gen.update!(status: 'retrying'); Portfolios::Generator.mark_exhausted!(gen, 'Failed after 6 retries: API returned 503')
    made['4a first scoring failed (retry offered)'] = p

    p = interviewed(org, assessment, 'Eko Prasetyo')
    run(p, 'session_end', -> { raise Gemini::HttpClient::ApiError.new('API returned 403', status: 403, body: { error: { message: 'API key not valid' } }.to_json) })
    made['4b first scoring failed (needs admin)'] = p

    p = interviewed(org, assessment, 'Fajar Nugroho')
    run(p, 'session_end', demo_output(react_level: 3)); override(p, 'React / Frontend Development Core', 4, 'Stronger than rated')
    run(p, 'admin_rescore', demo_output(react_level: 2))
    made['5 decision needs review (AI changed)'] = p

    p = interviewed(org, assessment, 'Gita Maharani')
    run(p, 'session_end', demo_output); override(p, 'Event streaming (Kafka)', 3, 'Clearly ran it in production')
    run(p, 'admin_rescore', demo_output(with_kafka: false))
    made['6 earlier decision, topic gone'] = p

    p = interviewed(org, assessment, 'Hadi Wijaya')
    Portfolios::RequestGeneration.new(portfolio: p, source: 'session_end', enqueue: false).call
    made['7 first scoring in progress'] = p

    puts "Demo assessment ##{assessment.id} '#{DEMO_ASSESSMENT}' (tenant #{org.scheme}):"
    made.each { |label, pf| puts "  #{label.ljust(40)} /assessments/#{assessment.id}/sessions/#{pf.session_id}/portfolio" }
  end

  namespace :portfolio_states do
    desc 'Remove the demo assessment and its candidates'
    task clear: :environment do
      RequestStore.clear!
      Assessment.unscoped.where(name: DEMO_ASSESSMENT).find_each do |a|
        Session.unscoped.where(assessment_id: a.id).find_each(&:destroy!)
        a.assessment_skills.delete_all
        a.delete
      end
      puts 'Demo data removed.'
    end
  end
end
