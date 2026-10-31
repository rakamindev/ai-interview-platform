# frozen_string_literal: true

raise 'Demo fixtures are only allowed in development' unless Rails.env.development?

organization = Organization.find_or_create_by!(scheme: 'synthetic-demo') do |record|
  record.name = 'Synthetic demo'
  record.identifier = 'synthetic-demo'
  record.host = 'synthetic-demo'
end

Current.using(tenant_id: organization.id, organization: organization) do
  assessment = Assessment.find_or_create_by!(name: 'Synthetic frontend assessment', tenant_id: organization.id) do |record|
    record.created_by = 1
    record.time_limit_min = 30
  end
  session = assessment.sessions.first || Session.create!(assessment: assessment, tenant_id: organization.id, status: 'ended', candidate_name: 'Synthetic candidate')
  portfolio = session.portfolio || Portfolio.create!(session: session, generation_status: 'complete', generated_at: Time.current)
  AssessorOverride.where(portfolio_skill_id: portfolio.portfolio_skills.select(:id)).destroy_all
  session.transcript_turns.find_or_create_by!(turn_number: 1) do |turn|
    turn.speaker = 'ai'
    turn.text = 'Synthetic interview question: how did you investigate a rendering issue?'
  end
  session.transcript_turns.find_or_create_by!(turn_number: 2) do |turn|
    turn.speaker = 'candidate'
    turn.text = 'Synthetic quote: I reproduced a rendering issue, isolated its cause, and checked the fix.'
  end
  [ ['react', 'React', 2, 'high'], ['testing', 'Testing and debugging', 3, 'low'], ['communication', 'Technical communication', 3, 'high'] ].each do |id, label, level, confidence|
    skill = portfolio.portfolio_skills.find_or_initialize_by(skill_id: id)
    skill.update!(skill_label: label, ai_level: level, ai_confidence: confidence, competency_summary: 'Synthetic assessment fixture for demonstration. This is not a real candidate evaluation.', evidence: ['Synthetic quote: I reproduced a rendering issue, isolated its cause, and checked the fix.'])
  end
  vacancy = Vacancy.find_or_create_by!(tenant_id: organization.id, role_title: 'Frontend Engineer - synthetic demo') { |record| record.created_by = 1 }
  [ ['react', 'React', 3], ['testing', 'Testing and debugging', 3], ['communication', 'Technical communication', 2], ['system-design', 'System design', 3] ].each do |id, label, expected|
    skill = vacancy.vacancy_skills.find_or_initialize_by(skill_id: id)
    skill.update!(skill_label: label, expected_level: expected)
  end
  empty = Vacancy.find_or_create_by!(tenant_id: organization.id, role_title: 'Unconfigured vacancy - synthetic demo') { |record| record.created_by = 1 }
  private_dir = Rails.root.join('../assessment/private')
  FileUtils.mkdir_p(private_dir)
  token = JsonWebToken.encode(user_id: 1, role: 'assessor', scheme: organization.scheme)
  File.write(Rails.root.join('../web/.env.local'), "VITE_API_BASE_URL=http://127.0.0.1:3001/api/v1\nVITE_DEV_TOKEN=#{token}\nVITE_DEV_TENANT_NAME=Synthetic demo\n")
  File.write(private_dir.join('demo.json'), { assessment_id: assessment.id, session_id: session.id, portfolio_id: portfolio.id, vacancy_id: vacancy.id, empty_vacancy_id: empty.id }.to_json)
  puts 'Synthetic demo prepared. Token was written only to ignored web/.env.local.'
end
