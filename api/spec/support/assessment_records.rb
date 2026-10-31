# frozen_string_literal: true

module AssessmentRecords
  def create_records(scheme: 'fixture-org')
    organization = Organization.create!(name: scheme, scheme: scheme, identifier: scheme, host: scheme)
    assessment = Assessment.create!(tenant_id: organization.id, created_by: 1, name: 'Synthetic assessment', time_limit_min: 30)
    session = Session.create!(tenant_id: organization.id, assessment: assessment, status: 'ended')
    portfolio = Portfolio.create!(session: session, generation_status: 'complete')
    skill = portfolio.portfolio_skills.create!(skill_id: 'react', skill_label: 'React', ai_level: 2, ai_confidence: 'low', competency_summary: 'Synthetic fixture, not a real evaluation.', evidence: ['Synthetic interview evidence.'])
    vacancy = Vacancy.create!(tenant_id: organization.id, created_by: 1, role_title: 'Synthetic Frontend Engineer')
    vacancy.vacancy_skills.create!(skill_id: 'react', skill_label: 'React', expected_level: 3)
    { organization: organization, assessment: assessment, session: session, portfolio: portfolio, skill: skill, vacancy: vacancy }
  end

  def headers_for(organization, role: 'assessor')
    token = JsonWebToken.encode(user_id: 1, role: role, scheme: organization.scheme)
    { 'Authorization' => "Bearer #{token}" }
  end
end
