# frozen_string_literal: true

# Minimal record builders for service specs. The schema has many NOT NULL
# columns, so keeping the defaults in one place keeps the specs readable.
module InterviewRecords
  TENANT_ID = 1

  def build_assessment(**attrs)
    Assessment.create!({ tenant_id: TENANT_ID, created_by: 1, name: 'Backend Engineer', time_limit_min: 30 }.merge(attrs))
  end

  def build_session(assessment: build_assessment, **attrs)
    Session.create!({ tenant_id: TENANT_ID, assessment: assessment, status: 'ended' }.merge(attrs))
  end

  def add_coverage(session, label, state:, probe_count:, skill_id: nil, discovered: false)
    session.coverage_maps.create!(skill_id: skill_id, skill_label: label, state: state,
                                  probe_count: probe_count, is_discovered: discovered)
  end

  def build_portfolio(session: build_session, status: 'complete')
    Portfolio.create!(session: session, generation_status: status)
  end

  def add_portfolio_skill(portfolio, label, level:, skill_id: nil, discovered: false)
    portfolio.portfolio_skills.create!(skill_id: skill_id, skill_label: label, is_discovered: discovered,
                                       ai_level: level, ai_confidence: 'medium', evidence: [],
                                       competency_summary: 'Summary')
  end

  def add_override(portfolio_skill, level:, notes: 'Assessor note', by: 42)
    portfolio_skill.create_assessor_override!(ai_level: portfolio_skill.ai_level, override_level: level,
                                              assessor_notes: notes, overridden_by: by)
  end

  def build_vacancy(skills)
    vacancy = Vacancy.create!(tenant_id: TENANT_ID, created_by: 1, role_title: 'Backend Engineer')
    skills.each { |s| vacancy.vacancy_skills.create!(s) }
    vacancy
  end

  # Stands in for Gemini::HttpClient. Pass a Hash/String to return it, or an
  # exception instance to raise it.
  class FakeGemini
    attr_reader :calls

    def initialize(response)
      @response = response
      @calls = 0
    end

    def generate_content(_prompt, **)
      @calls += 1
      raise @response if @response.is_a?(Exception)

      @response
    end
  end
end

RSpec.configure do |config|
  config.include InterviewRecords
end
