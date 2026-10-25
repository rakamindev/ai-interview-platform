module AssessmentFixtures
  def create_review(tenant_id: 101)
    Current.tenant_id = tenant_id
    assessment = Assessment.create!(tenant_id: tenant_id, created_by: 1, name: 'Synthetic engineering review', time_limit_min: 30)
    session = assessment.sessions.create!(tenant_id: tenant_id, candidate_name: 'Demo Candidate', status: 'ended')
    portfolio = session.create_portfolio!(generation_status: 'complete', generated_at: Time.current)
    vacancy = Vacancy.create!(tenant_id: tenant_id, created_by: 1, role_title: 'Backend Engineer')
    [portfolio, vacancy]
  end

  def add_rating(portfolio, label: 'Database design', skill_id: 'SK-ENG-004', level: 3, confidence: 'high')
    portfolio.portfolio_skills.create!(skill_label: label, skill_id: skill_id, ai_level: level,
      ai_confidence: confidence, competency_summary: 'Synthetic evidence for a local review.',
      evidence: ['I used a transaction to keep both writes consistent.'])
  end

  def add_requirement(vacancy, label: 'Database design', skill_id: 'SK-ENG-004', level: 3)
    vacancy.vacancy_skills.create!(skill_label: label, skill_id: skill_id, expected_level: level)
  end

  def assessor_headers(tenant_id: 101, role: 'admin')
    org = Organization.find_or_create_by!(scheme: "spec-#{tenant_id}") do |record|
      record.id = tenant_id
      record.name = "Synthetic #{tenant_id}"
      record.identifier = "spec-#{tenant_id}"
      record.host = "spec-#{tenant_id}.test"
    end
    { 'Authorization' => "Bearer #{JsonWebToken.encode(user_id: 1, role: role, scheme: org.scheme)}" }
  end
end
