# frozen_string_literal: true

# Demo data for the results screens, without calling Gemini.
#
#   bundle exec rails runner db/seeds/demo_interview.rb
#
# Builds a finished interview and runs the real Portfolios::Generator and
# FitGap::Engine against canned model answers, so what you see went through
# the same validation as production data. Everything here is fictional.
# Safe to re-run: the previous demo assessment and vacancy are replaced.

ASSESSMENT_NAME = '[Demo] Senior Frontend Engineer'
VACANCY_TITLE   = '[Demo] Senior Frontend Engineer, Payments'

# Gemini stand-in: returns one fixed answer.
class CannedModel
  def initialize(answer) = @answer = answer
  def generate_content(*, **) = @answer
end

org = Organization.where.not(id: 0).order(:id).first or abort('Run rails db:seed first to create an organization.')

Current.organization = org
Current.tenant_id = org.id

ActiveRecord::Base.transaction do
  Assessment.where(name: ASSESSMENT_NAME).find_each do |old|
    old.sessions.each { |s| s.portfolio&.destroy; s.destroy }
    old.destroy
  end
  Vacancy.where(role_title: VACANCY_TITLE).destroy_all

  anchors = {
    l1_anchor: 'Needs guidance on routine work.',
    l2_anchor: 'Handles routine work independently.',
    l3_anchor: 'Handles ambiguous work and explains trade-offs.',
    l4_anchor: 'Sets standards other engineers follow.',
    l5_anchor: 'Shapes how the organisation practices this skill.'
  }

  assessment = Assessment.create!(
    name: ASSESSMENT_NAME, created_by: 1, time_limit_min: 45,
    assessment_skills_attributes: [
      { skill_id: 'demo-react', skill_label: 'React / Frontend Development', display_order: 1, expected_level: 3, **anchors },
      { skill_label: 'Communication', is_custom: true, display_order: 2, expected_level: 3, **anchors },
      { skill_label: 'Frontend Testing', is_custom: true, display_order: 3, expected_level: 3, **anchors },
      { skill_id: 'demo-design', skill_label: 'System Design', display_order: 4, expected_level: 2, **anchors }
    ]
  )

  session = Session.create!(
    assessment:, status: 'ended', end_reason: 'time_ceiling', candidate_name: 'Demo Candidate',
    started_at: 46.minutes.ago, ended_at: 1.minute.ago, duration_seconds: 45 * 60
  )

  turns = [
    ['ai', 'Thanks for joining. Tell me about the hardest frontend problem you worked on recently.'],
    ['candidate', 'We built a live order tracking dashboard. Hundreds of updates a second came in over a websocket and the whole page kept re-rendering.'],
    ['ai', 'What was actually re-rendering, and how did you find out?'],
    ['candidate', 'I used the React profiler and saw every order row re-rendered on each message. We moved the fast-changing values into refs and memoised the rows, and render time dropped from about 40 milliseconds to under 5.'],
    ['ai', 'How did you decide what stayed in global state?'],
    ['candidate', 'Anything shared across pages stayed in the store, anything only one widget cared about moved local. I wrote that rule down in our frontend guide so new people would follow it.'],
    ['ai', 'You wrote it down. How did the rest of the team react to the change?'],
    ['candidate', 'Two seniors pushed back because they liked having everything in one place. I showed them the profiler recordings in a short call and we agreed to try it on one page first.'],
    ['ai', 'And testing, how did you make sure the refactor did not break anything?'],
    ['candidate', 'Mostly manual checks, to be honest.']
  ]
  turns.each_with_index do |(speaker, text), i|
    TranscriptTurn.create!(session:, turn_number: i + 1, speaker:, text:)
  end

  [
    ['demo-react', 'React / Frontend Development', 'covered', 4],
    [nil, 'Communication', 'partial', 2],
    [nil, 'Frontend Testing', 'initiated', 1],
    ['demo-design', 'System Design', 'not_yet', 0]
  ].each do |skill_id, label, state, probes|
    CoverageMap.create!(session:, skill_id:, skill_label: label, state:, probe_count: probes)
  end
  CoverageMap.create!(session:, skill_label: 'Technical Writing', is_discovered: true, state: 'initiated', probe_count: 1)

  model_answer = {
    'configured_skills' => [
      { 'skill_id' => 'demo-react', 'skill_label' => 'React / Frontend Development', 'level' => 3,
        'evidence' => [
          'We moved the fast-changing values into refs and memoised the rows',
          'render time dropped from about 40 milliseconds to under 5',
          'I have shipped React apps used by millions of people' # not in the transcript: will be dropped
        ],
        'competency_summary' => 'Diagnoses render performance with real measurements and fixes it with targeted ' \
                                'changes rather than rewrites. Turns a one-off fix into a team rule, which points ' \
                                'towards L4, but there is no sign yet of standards adopted beyond the immediate team.' },
      { 'skill_label' => 'Communication', 'level' => 3,
        'evidence' => ['I showed them the profiler recordings in a short call and we agreed to try it on one page first'],
        'competency_summary' => 'Handles disagreement with evidence and proposes a low-risk trial instead of arguing preferences.' },
      { 'skill_label' => 'Frontend Testing', 'level' => 'L1',
        'evidence' => ['Mostly manual checks, to be honest.'],
        'competency_summary' => 'Relied on manual checks for a risky refactor. Only one exchange, so this is thin.' },
      # The interview never reached System Design; this guess is ignored.
      { 'skill_id' => 'demo-design', 'skill_label' => 'System Design', 'level' => 1,
        'evidence' => [], 'competency_summary' => 'No evidence.' }
    ],
    'discovered_skills' => [
      { 'skill_label' => 'Technical Writing', 'level' => 2,
        'evidence' => ['I wrote that rule down in our frontend guide so new people would follow it'],
        'competency_summary' => 'Documents decisions for the team without being asked.' }
    ]
  }

  portfolio = Portfolios::Generator.new(session:, gemini_client: CannedModel.new(model_answer)).call

  vacancy = Vacancy.create!(
    role_title: VACANCY_TITLE, created_by: 1,
    culture_dimensions: 'Ownership, async-first communication, evidence over opinion',
    vacancy_skills_attributes: [
      { skill_id: 'demo-react', skill_label: 'React / Frontend Development', expected_level: 3 },
      { skill_label: 'Communication', expected_level: 3 },
      { skill_label: 'Frontend Testing', expected_level: 3 },
      { skill_id: 'demo-design', skill_label: 'System Design', expected_level: 2 }
    ]
  )

  FitGap::Engine.new(
    portfolio:, vacancy:,
    gemini_client: CannedModel.new(
      'culture_narrative' => 'Settles disagreements with measurements and small trials, which fits an ' \
                             'evidence-over-opinion culture. Writes decisions down for others, a good sign for async work.',
      'overall_narrative' => 'Meets the React and communication bar. Testing is rated below the requirement on ' \
                             'thin, low-confidence evidence and should be checked in a follow-up. System design ' \
                             'was not assessed in this interview and needs its own conversation before a decision.'
    )
  ).call

  puts "Demo ready (organization #{org.scheme}):"
  puts "  /assessments/#{assessment.id}/sessions/#{session.id}/portfolio"
  puts "  /assessments/#{assessment.id}/sessions/#{session.id}/fitgap/#{vacancy.id}"
end
