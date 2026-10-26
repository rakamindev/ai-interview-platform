# frozen_string_literal: true

# Builds a realistic portfolio × vacancy pair in one tenant:
#   React         expected 3, AI 3 high      → match
#   Communication expected 3, AI 2 low       → gap, needs verification
#   System Design expected 2, AI 3 high      → exceed
#   Kubernetes    expected 2, never probed   → not assessed
module FitGapHelpers
  def build_fit_gap_scenario(organization: create(:organization))
    assessment = create(:assessment, organization:)
    portfolio = create(:portfolio, session: create(:session, assessment:))
    vacancy = create(:vacancy, organization:, culture_dimensions: 'ownership, async-first')

    skills = {
      react: create(:portfolio_skill, portfolio:, skill_id: 'react', skill_label: 'React', ai_level: 3),
      communication: create(:portfolio_skill, portfolio:, skill_id: 'communication', skill_label: 'Communication',
                                              ai_level: 2, ai_confidence: 'low'),
      design: create(:portfolio_skill, portfolio:, skill_id: 'design', skill_label: 'System Design', ai_level: 3)
    }
    create(:vacancy_skill, vacancy:, skill_id: 'react', skill_label: 'React', expected_level: 3)
    create(:vacancy_skill, vacancy:, skill_id: 'communication', skill_label: 'Communication', expected_level: 3)
    create(:vacancy_skill, vacancy:, skill_id: 'design', skill_label: 'System Design', expected_level: 2)
    create(:vacancy_skill, vacancy:, skill_id: nil, skill_label: 'Kubernetes', expected_level: 2)

    { organization:, portfolio:, vacancy:, skills: }
  end

  # Narrator double returning fixed model output.
  def fake_model(response = nil, error: nil)
    client = instance_double(Gemini::HttpClient)
    if error
      allow(client).to receive(:generate_content).and_raise(error)
    else
      allow(client).to receive(:generate_content).and_return(response)
    end
    client
  end

  def ai_narrative
    { 'culture_narrative' => 'Strong ownership signals.', 'overall_narrative' => 'Probe async communication next.' }
  end
end

RSpec.configure do |config|
  config.include FitGapHelpers
end
