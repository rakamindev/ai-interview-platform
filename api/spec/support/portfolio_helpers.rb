# frozen_string_literal: true

# Builds a full portfolio chain (assessment -> session -> portfolio -> skill)
# for one organisation. All data is fictional.
module PortfolioHelpers
  def other_organization
    @other_organization ||= Organization.find_by(scheme: 'other-corp') ||
                            Organization.create!(
                              name:       'Other Corp',
                              scheme:     'other-corp',
                              identifier: 'other-corp',
                              host:       'other.local'
                            )
  end

  def create_portfolio_for(organization, status: 'complete', ai_level: 3)
    with_tenant(organization) do
      assessment = Assessment.create!(name: "Assessment #{organization.scheme}", time_limit_min: 10, created_by: 1)
      session    = assessment.sessions.create!(candidate_name: 'Kandidat Fiktif')
      portfolio  = session.create_portfolio!(generation_status: status)
      skill      = portfolio.portfolio_skills.create!(
        skill_id:           'SK-ENG-004',
        skill_label:        'Database Design & SQL',
        ai_level:           ai_level,
        ai_confidence:      'high',
        competency_summary: 'Ringkasan fiktif.',
        evidence:           ['Kutipan fiktif.']
      )
      { session:, portfolio:, skill: }
    end
  end

  def create_vacancy_for(organization, skill_label: 'Database Design & SQL', expected_level: 3)
    with_tenant(organization) do
      vacancy = Vacancy.create!(role_title: "Lowongan #{organization.scheme}", created_by: 1)
      vacancy.vacancy_skills.create!(skill_id: 'SK-ENG-004', skill_label:, expected_level:)
      vacancy
    end
  end

  def json
    JSON.parse(response.body)
  end
end

RSpec.configure do |config|
  config.include PortfolioHelpers, type: :request
end
