# frozen_string_literal: true

# Small explicit builders instead of factories: every column a test depends on is visible in the spec.
module Builders
  def build_org(scheme: 'acme')
    Organization.create!(name: scheme, scheme: scheme, identifier: scheme, host: "#{scheme}.example.test")
  end

  def build_assessment(org, language: 'en')
    Assessment.create!(tenant_id: org.id, created_by: 1, name: 'Backend role', time_limit_min: 30, language: language)
  end

  def build_session(org, assessment: build_assessment(org))
    Session.create!(tenant_id: org.id, assessment: assessment)
  end

  def build_portfolio(session, status: 'complete')
    Portfolio.create!(session: session, generation_status: status)
  end

  def add_portfolio_skill(portfolio, label:, level:, confidence: 'high', skill_id: nil, discovered: false)
    PortfolioSkill.create!(portfolio: portfolio, skill_label: label, skill_id: skill_id, ai_level: level,
                           ai_confidence: confidence, is_discovered: discovered,
                           competency_summary: 'Summary', evidence: [])
  end

  def build_vacancy(org, skills:, culture: nil)
    Vacancy.create!(
      tenant_id: org.id, created_by: 1, role_title: 'Backend Engineer', culture_dimensions: culture,
      vacancy_skills_attributes: skills.map { |label, level| { skill_label: label, expected_level: level } }
    )
  end

  def auth_headers(org, role: 'assessor')
    token = JsonWebToken.encode(user_id: 42, role: role, scheme: org.scheme)
    { 'Authorization' => "Bearer #{token}", 'CONTENT_TYPE' => 'application/json' }
  end
end

RSpec.configure { |c| c.include Builders }
