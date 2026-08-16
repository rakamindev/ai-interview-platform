# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:assessment) { create(:assessment) }
  let!(:assessment_skill) do
    create(:assessment_skill, assessment: assessment, skill_id: 'sk-a', skill_label: 'Skill A')
  end
  let(:session) { create(:session, assessment: assessment) }
  let(:gemini_client) { instance_double(Gemini::HttpClient) }

  describe '#call' do
    context 'when a skill was not discussed' do
      before do
        create(:coverage_map, session: session, skill_id: 'sk-a', skill_label: 'Skill A',
                              state: 'not_yet', probe_count: 0)
      end

      it 'marks the skill not_assessed without calling Gemini' do
        expect(gemini_client).not_to receive(:generate_content)

        portfolio = Portfolios::Generator.new(session: session, gemini_client: gemini_client).call
        skill = portfolio.portfolio_skills.find_by(skill_label: 'Skill A')

        expect(skill.assessment_status).to eq('not_assessed')
        expect(skill.ai_level).to be_nil
        expect(skill.ai_confidence).to be_nil
      end
    end

    context 'when a skill has enough coverage' do
      before do
        create(:coverage_map, session: session, skill_id: 'sk-a', skill_label: 'Skill A',
                              state: 'covered', probe_count: 3)
      end

      it 'scores the skill from Gemini response' do
        allow(gemini_client).to receive(:generate_content).and_return(
          'configured_skills' => [
            {
              'skill_id' => 'sk-a',
              'skill_label' => 'Skill A',
              'level' => 4,
              'confidence' => 'high',
              'evidence' => ['quote'],
              'competency_summary' => 'Strong React depth.'
            }
          ],
          'discovered_skills' => []
        )

        portfolio = Portfolios::Generator.new(session: session, gemini_client: gemini_client).call
        skill = portfolio.portfolio_skills.find_by(skill_label: 'Skill A')

        expect(skill.assessment_status).to eq('assessed')
        expect(skill.ai_level).to eq(4)
        expect(skill.ai_confidence).to eq('high')
      end

      it 'fails when Gemini omits level for an assessed skill' do
        allow(gemini_client).to receive(:generate_content).and_return(
          'configured_skills' => [
            {
              'skill_id' => 'sk-a',
              'skill_label' => 'Skill A',
              'confidence' => 'high',
              'evidence' => ['quote'],
              'competency_summary' => 'Summary'
            }
          ],
          'discovered_skills' => []
        )

        portfolio = create(:portfolio, session: session, generation_status: 'generating')

        expect do
          Portfolios::Generator.new(session: session, gemini_client: gemini_client).call
        end.to raise_error(/Missing level/)

        expect(portfolio.reload.generation_status).to eq('failed')
      end
    end

    context 'when Gemini raises' do
      before do
        create(:coverage_map, session: session, skill_id: 'sk-a', skill_label: 'Skill A',
                              state: 'covered', probe_count: 3)
        allow(gemini_client).to receive(:generate_content).and_raise(StandardError, 'timeout')
      end

      it 'marks portfolio failed' do
        portfolio = create(:portfolio, session: session, generation_status: 'generating')

        expect do
          Portfolios::Generator.new(session: session, gemini_client: gemini_client).call
        end.to raise_error(StandardError)

        expect(portfolio.reload.generation_status).to eq('failed')
        expect(portfolio.generation_error).to include('timeout')
      end
    end
  end
end
