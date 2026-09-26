# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:mock_gemini_client) { instance_double(Gemini::HttpClient) }
  let(:session) { instance_double(Session, id: 99, candidate_id: 12) }
  let(:assessment) { instance_double(Assessment, name: 'Senior Fullstack Engineer') }

  let(:skill_1) do
    instance_double(AssessmentSkill, skill_id: 'SK-01', skill_label: 'React Core', display_order: 1)
  end
  let(:skill_2) do
    instance_double(AssessmentSkill, skill_id: 'SK-02', skill_label: 'Docker & DevOps', display_order: 2)
  end

  let(:map_1) do
    instance_double(CoverageMap, skill_label: 'React Core', state: 'covered', probe_count: 3)
  end
  let(:map_2) do
    instance_double(CoverageMap, skill_label: 'Docker & DevOps', state: 'not_yet', probe_count: 0)
  end

  let(:portfolio) { instance_double(Portfolio, id: 55) }
  let(:portfolio_skills_assoc) { double('portfolio_skills_association') }

  before do
    allow(session).to receive(:assessment).and_return(assessment)
    allow(session).to receive(:coverage_maps).and_return([map_1, map_2])
    allow(assessment).to receive(:assessment_skills).and_return(double(order: [skill_1, skill_2]))
    allow(portfolio).to receive(:portfolio_skills).and_return(portfolio_skills_assoc)
    allow(portfolio_skills_assoc).to receive(:destroy_all)
  end

  describe '#save_skills' do
    it 'cleans markdown fences, sanitizes confidence, and handles unassessed skills cleanly' do
      generator = described_class.new(session: session, gemini_client: mock_gemini_client)

      # Gemini response wrapped in markdown fence and with uppercase confidence
      raw_response = <<~JSON
        ```json
        {
          "configured_skills": [
            {
              "skill_id": "SK-01",
              "skill_label": "React Core",
              "level": 4,
              "confidence": "HIGH",
              "evidence": ["Quote from candidate"],
              "competency_summary": "Strong architectural grasp."
            },
            {
              "skill_id": "SK-02",
              "skill_label": "Docker & DevOps",
              "level": 0,
              "confidence": "low",
              "evidence": [],
              "competency_summary": ""
            }
          ],
          "discovered_skills": []
        }
        ```
      JSON

      # Expect Skill 1 to be saved with level 4, sanitized lowercase confidence 'high'
      expect(portfolio_skills_assoc).to receive(:create!).with(
        hash_including(
          skill_label: 'React Core',
          is_discovered: false,
          ai_level: 4,
          ai_confidence: 'high'
        )
      )

      # Expect Skill 2 (unassessed because probe_count=0 and state=not_yet) to be saved with ai_level: nil
      expect(portfolio_skills_assoc).to receive(:create!).with(
        hash_including(
          skill_label: 'Docker & DevOps',
          is_discovered: false,
          ai_level: nil,
          ai_confidence: nil,
          competency_summary: 'Skill was not covered during this interview session.'
        )
      )

      generator.send(:save_skills, portfolio, raw_response)
    end
  end
end

