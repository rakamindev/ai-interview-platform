namespace :review do
  desc 'Seed a synthetic assessor workflow (development only)'
  task demo: :environment do
    abort 'Synthetic demo is development-only' unless Rails.env.development?
    load Rails.root.join('db/seeds.rb')
    org = Organization.find_by!(scheme: 'test-corp')
    Current.tenant_id = org.id
    user = User.find_or_create_by!(email: 'assessor@example.test') do |record|
      record.role = 'admin'
      record.password = ENV.fetch('DEMO_PASSWORD', 'local-demo-only-2026')
    end
    assessment = Assessment.find_or_create_by!(name: 'Backend engineering | synthetic demo') do |record|
      record.created_by = user.id
      record.time_limit_min = 30
    end
    session = assessment.sessions.find_or_create_by!(candidate_name: 'Demo Candidate (synthetic)') do |record|
      record.status = 'ended'
      record.started_at = 30.minutes.ago
      record.ended_at = Time.current
      record.duration_seconds = 1800
      record.end_reason = 'manual_assessor'
    end
    portfolio = session.portfolio || session.create_portfolio!(generation_status: 'complete', generated_at: Time.current)
    vacancy = Vacancy.find_or_create_by!(role_title: 'Backend Engineer | synthetic demo') { |record| record.created_by = user.id }
    [
      ['SK-ENG-004', 'Database Design & SQL', 3, 3, 'high'],
      ['SK-ENG-005', 'RESTful API Design', 4, 2, 'medium'],
      ['SK-ENG-006', 'Testing & Quality Assurance', 2, 4, 'high'],
      ['SK-SOFT-001', 'Communication', 3, nil, nil]
    ].each do |id, label, expected, level, confidence|
      vacancy.vacancy_skills.find_or_create_by!(skill_id: id) { |skill| skill.skill_label = label; skill.expected_level = expected }
      next unless level
      skill = portfolio.portfolio_skills.find_or_create_by!(skill_id: id) do |record|
        record.skill_label = label
        record.ai_level = level
        record.ai_confidence = confidence
        record.evidence = ['Synthetic example: I verified the failure path before releasing the change.']
        record.competency_summary = 'Demonstrates the stated level in this synthetic fixture. Not a real candidate assessment.'
      end
      if id == 'SK-ENG-005'
        skill.create_assessor_override!(ai_level: level, override_level: 3, overridden_by: user.id,
          assessor_notes: 'Synthetic human review: evidence supports L3, with room for improvement.', overridden_at: Time.current) unless skill.assessor_override
      end
    end
    if session.transcript_turns.empty?
      session.transcript_turns.create!(turn_number: 1, speaker: 'ai', text: 'Synthetic interviewer: how do you verify a database change?')
      session.transcript_turns.create!(turn_number: 2, speaker: 'candidate', text: 'Synthetic example: I verified the failure path before releasing the change.')
    end
    puts "SYNTHETIC DEMO: assessment=#{assessment.id} session=#{session.id} portfolio=#{portfolio.id} vacancy=#{vacancy.id}"
    puts "Login: assessor@example.test (password from DEMO_PASSWORD or documented local-only default)"
    puts "Review: http://localhost:5174/assessments/#{assessment.id}/sessions/#{session.id}/fitgap/#{vacancy.id}"
  ensure
    Current.clear
  end
end
