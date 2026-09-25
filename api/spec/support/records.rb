module TestRecords
  def organization(scheme = 'review')
    Organization.create!(name: scheme, scheme: scheme, identifier: scheme, host: "#{scheme}.test")
  end

  def assessment_session(org, status: 'ended')
    assessment = Assessment.create!(tenant_id: org.id, created_by: 1, name: 'Engineer', time_limit_min: 30)
    assessment.assessment_skills.create!(skill_id: 'ruby', skill_label: 'Ruby', l1_anchor: '1', l2_anchor: '2', l3_anchor: '3', l4_anchor: '4', l5_anchor: '5')
    assessment.sessions.create!(tenant_id: org.id, status: status)
  end

  def portfolio_for(session)
    session.create_portfolio!(generation_status: 'complete')
  end

  def skill_for(portfolio, **attributes)
    portfolio.portfolio_skills.create!({skill_id: 'ruby', skill_label: 'Ruby', ai_level: 3, ai_confidence: 'high', evidence: ['I test my code'], competency_summary: 'Uses tests'}.merge(attributes))
  end

  def vacancy_for(org)
    vacancy = Vacancy.create!(tenant_id: org.id, created_by: 1, role_title: 'Engineer')
    vacancy.vacancy_skills.create!(skill_id: 'ruby', skill_label: 'Ruby', expected_level: 3)
    vacancy
  end

  def headers_for(org, role: 'admin')
    { 'Authorization' => "Bearer #{JsonWebToken.encode(user_id: 1, role: role, scheme: org.scheme)}" }
  end
end
RSpec.configure { |config| config.include TestRecords }
