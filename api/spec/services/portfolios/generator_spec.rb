# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:assessment) { create(:assessment) }
  let(:session) { create(:session, assessment: assessment) }

  let(:sample_gemini_response) do
    {
      'configured_skills' => [
        {
          'skill_id' => 'sk-rails-01',
          'skill_label' => 'Ruby on Rails',
          'level' => 3,
          'confidence' => 'high',
          'evidence' => ['Explained Rails connection pooling.'],
          'competency_summary' => 'Solid Rails knowledge.'
        }
      ],
      'discovered_skills' => [
        {
          'skill_label' => 'Docker & Containerization',
          'level' => 2,
          'confidence' => 'low',
          'evidence' => ['Mentioned using docker-compose locally.'],
          'competency_summary' => 'Basic container usage.'
        }
      ]
    }
  end

  let(:mock_gemini_client) do
    instance_double(
      Gemini::HttpClient,
      generate_content: sample_gemini_response
    )
  end

  subject(:generator) { described_class.new(session: session, gemini_client: mock_gemini_client) }

  describe '#call' do
    it 'creates portfolio and populates skills' do
      portfolio = generator.call

      expect(portfolio.generation_status).to eq('complete')
      expect(portfolio.portfolio_skills.count).to be >= 2

      rails_skill = portfolio.portfolio_skills.find_by(skill_label: 'Ruby on Rails')
      expect(rails_skill).not_to be_nil
      expect(rails_skill.ai_level).to eq(3)
      expect(rails_skill.ai_confidence).to eq('high')

      discovered = portfolio.portfolio_skills.find_by(is_discovered: true)
      expect(discovered.skill_label).to eq('Docker & Containerization')
    end

    it 'preserves human assessor overrides across regeneration (BUG-03 verification)' do
      # Initial generation
      portfolio = generator.call
      rails_skill = portfolio.portfolio_skills.find_by(skill_label: 'Ruby on Rails')

      # Assessor applies override
      rails_skill.create_assessor_override!(
        ai_level: 3,
        override_level: 4,
        assessor_notes: 'Demonstrated senior level in deep dive.',
        overridden_by: 1
      )

      # Regenerate portfolio
      regenerated = generator.call
      reloaded_rails = regenerated.portfolio_skills.find_by(skill_label: 'Ruby on Rails')

      expect(reloaded_rails.assessor_override).not_to be_nil
      expect(reloaded_rails.assessor_override.override_level).to eq(4)
      expect(reloaded_rails.assessor_override.assessor_notes).to eq('Demonstrated senior level in deep dive.')
    end

    it 'ensures unassessed configured assessment skills are preserved (GAP-02 verification)' do
      # Gemini only returned Ruby on Rails, but assessment also has React / Frontend
      portfolio = generator.call

      react_skill = portfolio.portfolio_skills.find_by(skill_label: 'React / Frontend')
      expect(react_skill).not_to be_nil
      expect(react_skill.competency_summary).to include('not probed or evaluated')
      expect(react_skill.ai_confidence).to eq('low')
    end

    context 'when Gemini fails' do
      before do
        allow(mock_gemini_client).to receive(:generate_content).and_raise(StandardError.new('Gemini unavailable'))
      end

      it 'sets generation_status to failed and re-raises' do
        expect { generator.call }.to raise_error(StandardError)
        expect(session.portfolio.generation_status).to eq('failed')
        expect(session.portfolio.generation_error).to eq('Gemini unavailable')
      end
    end
  end
end
