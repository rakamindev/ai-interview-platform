# Reproduces Step 3 findings against the real services with a stubbed model client.
# Run: docker compose exec -T api bundle exec rails runner tmp/repro_findings.rb
# Synthetic data only — no real personal data.

class FakeGemini
  def initialize(response) = @response = response
  def generate_content(_prompt, temperature: 0.2) = @response
end

org = Organization.find_by!(scheme: 'test-corp')
Current.organization = org
Current.tenant_id = org.id

skills = [
  ['SK-ENG-001', 'React / Frontend Development Core', 3],
  ['SK-SOFT-001', 'Communication', 3],
  ['SK-ENG-003', 'System Design & Architecture', 2]
]

assessment = Assessment.create!(
  name: 'Repro: Senior Frontend Engineer', time_limit_min: 30, created_by: 1,
  assessment_skills_attributes: skills.each_with_index.map do |(id, label, lvl), i|
    t = SkillTaxonomy.find_by!(skill_id: id)
    { skill_id: id, skill_label: label, expected_level: lvl, display_order: i,
      l1_anchor: t.l1_anchor, l2_anchor: t.l2_anchor, l3_anchor: t.l3_anchor,
      l4_anchor: t.l4_anchor, l5_anchor: t.l5_anchor }
  end
)

vacancy = Vacancy.create!(
  role_title: 'Repro: Senior Frontend Engineer', created_by: 1,
  vacancy_skills_attributes: skills.map { |id, label, lvl| { skill_id: id, skill_label: label, expected_level: lvl } }
)

# Session ended after 6 minutes: only React was discussed; the candidate's connection dropped.
session = assessment.sessions.create!(candidate_name: 'Kandidat Contoh', status: 'ended',
                                      end_reason: 'error', started_at: 6.minutes.ago,
                                      ended_at: Time.current, duration_seconds: 360)
[
  ['ai', 'Tell me about the most technically challenging frontend project you worked on recently.'],
  ['candidate', 'I built a logistics dashboard with hundreds of realtime updates per second; re-renders were the main problem.'],
  ['ai', 'How did you find which renders were unnecessary?'],
  ['candidate', 'We profiled with React DevTools and moved hot data into useRef so it stopped triggering renders.']
].each_with_index { |(sp, tx), i| session.transcript_turns.create!(turn_number: i + 1, speaker: sp, text: tx) }

session.coverage_maps.create!(skill_id: 'SK-ENG-001', skill_label: skills[0][1], state: 'partial',  probe_count: 2)
session.coverage_maps.create!(skill_id: 'SK-SOFT-001', skill_label: skills[1][1], state: 'not_yet', probe_count: 0)
session.coverage_maps.create!(skill_id: 'SK-ENG-003', skill_label: skills[2][1], state: 'not_yet', probe_count: 0)

# A careful model answers honestly: two skills had no evidence, so it returns no level.
model_output = {
  'configured_skills' => [
    { 'skill_id' => 'SK-ENG-001', 'skill_label' => skills[0][1], 'level' => 3, 'confidence' => 'medium',
      'evidence' => ['We profiled with React DevTools and moved hot data into useRef'],
      'competency_summary' => 'Shows L3 profiling-driven optimisation; thin signal beyond performance.' },
    { 'skill_id' => 'SK-SOFT-001', 'skill_label' => skills[1][1], 'level' => nil, 'confidence' => 'low',
      'evidence' => [], 'competency_summary' => 'Not assessed: the interview ended before this skill was discussed.' },
    { 'skill_id' => 'SK-ENG-003', 'skill_label' => skills[2][1], 'level' => 'N/A', 'confidence' => 'low',
      'evidence' => [], 'competency_summary' => 'Not assessed: no evidence in the transcript.' }
  ],
  'discovered_skills' => []
}

session.create_portfolio!(generation_status: 'pending')
Portfolios::Generator.new(session: session, gemini_client: FakeGemini.new(model_output)).call
portfolio = session.reload.portfolio

puts "\n== Finding: unassessed skills are stored as real ratings =="
portfolio.portfolio_skills.order(:id).each do |s|
  cov = session.coverage_maps.find_by(skill_label: s.skill_label)
  puts format('  %-36s coverage=%-8s probes=%d  -> stored ai_level=L%d (%s)',
              s.skill_label, cov.state, cov.probe_count, s.ai_level, s.ai_confidence)
end

FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: FakeGemini.new('not json')).call
report = FitGapReport.find_by!(portfolio: portfolio, vacancy: vacancy)

puts "\n== Finding: fit/gap reports those fake ratings as skill gaps =="
report.skill_comparisons.each do |c|
  puts format('  %-36s expected=L%s candidate=L%s -> %s', c['skill_label'], c['expected_level'], c['candidate_level'], c['result'])
end
puts "  narrative fallback: #{report.overall_narrative}"
puts "  payload keys sent to web: #{report.skill_comparisons.first.keys.join(', ')}"

puts "\n== Finding: model omits a skill -> it silently disappears from the portfolio =="
session2 = assessment.sessions.create!(candidate_name: 'Kandidat Dua', status: 'ended', end_reason: 'time_ceiling',
                                       started_at: 30.minutes.ago, ended_at: Time.current)
session2.transcript_turns.create!(turn_number: 1, speaker: 'candidate', text: 'Synthetic answer.')
session2.create_portfolio!(generation_status: 'pending')
Portfolios::Generator.new(session: session2,
                          gemini_client: FakeGemini.new('configured_skills' => [model_output['configured_skills'][0]])).call
puts "  configured skills: #{assessment.assessment_skills.count}, portfolio skills: #{session2.reload.portfolio.portfolio_skills.count}"

puts "\n== Finding: invalid model value aborts mid-write (partial portfolio) =="
session3 = assessment.sessions.create!(candidate_name: 'Kandidat Tiga', status: 'ended', end_reason: 'manual_candidate',
                                       started_at: 30.minutes.ago, ended_at: Time.current)
session3.transcript_turns.create!(turn_number: 1, speaker: 'candidate', text: 'Synthetic answer.')
session3.create_portfolio!(generation_status: 'pending')
bad = model_output.deep_dup
bad['configured_skills'][1]['confidence'] = 'Low' # capitalised: fails the enum validation
begin
  Portfolios::Generator.new(session: session3, gemini_client: FakeGemini.new(bad)).call
rescue => e
  p3 = session3.reload.portfolio
  puts "  raised #{e.class}: #{e.message}"
  puts "  portfolio status=#{p3.generation_status}, skills written before the failure=#{p3.portfolio_skills.count}"
end

puts "\n== Finding: hallucinated evidence quotes are accepted =="
fake_quote = model_output.deep_dup
fake_quote['configured_skills'][0]['evidence'] = ['I led a team of 40 engineers migrating to micro-frontends']
session4 = assessment.sessions.create!(candidate_name: 'Kandidat Empat', status: 'ended', end_reason: 'manual_candidate',
                                       started_at: 30.minutes.ago, ended_at: Time.current)
session.transcript_turns.each { |t| session4.transcript_turns.create!(t.attributes.slice('turn_number', 'speaker', 'text')) }
session4.create_portfolio!(generation_status: 'pending')
Portfolios::Generator.new(session: session4, gemini_client: FakeGemini.new(fake_quote)).call
q = session4.reload.portfolio.portfolio_skills.first.evidence.first
puts "  stored quote: #{q.inspect}"
puts "  appears in transcript? #{session4.transcript_turns.where('text ILIKE ?', "%#{q}%").exists?}"

puts "\nIDs: assessment=#{assessment.id} session=#{session.id} portfolio=#{portfolio.id} vacancy=#{vacancy.id}"
