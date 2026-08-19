# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::Analyzer do
  let(:session) { create(:session, :active) }
  let(:gemini_client) { instance_double('Gemini::HttpClient') }
  let(:analyzer) { described_class.new(session: session, gemini_client: gemini_client) }

  before do
    allow(Coverage::StateEngine).to receive(:resolve_state).and_return('partial')
  end

  describe '#call' do
    context 'when there are no transcript turns' do
      it 'returns empty updates' do
        result = analyzer.call
        expect(result).to eq({ skill_updates: [], discovered_skills: [] })
      end
    end

    context 'when there are transcript turns' do
      let!(:turn1) { create(:transcript_turn, session: session, speaker: 'ai', text: 'Do you know Ruby?', turn_number: 1) }
      let!(:turn2) { create(:transcript_turn, session: session, speaker: 'candidate', text: 'I love Ruby.', turn_number: 2) }
      
      let!(:assessment) { create(:assessment) }
      let!(:skill) { create(:assessment_skill, assessment: assessment, skill_label: 'Ruby') }
      let!(:coverage_map) { create(:coverage_map, session: session, skill_label: 'Ruby', state: 'not_yet', probe_count: 0) }

      before do
        session.update!(assessment: assessment)
        
        # Stub the Gemini client response
        gemini_response = {
          'skill_updates' => [
            {
              'id' => coverage_map.skill_label.downcase.gsub(/\s+/, '-'),
              'new_state' => 'partial',
              'new_probe_count' => 1,
              'reason' => 'Mentioned Ruby'
            }
          ],
          'discovered_skills' => [
            {
              'label' => 'RSpec',
              'first_mention' => 'Mentioned testing'
            }
          ]
        }
        
        allow(gemini_client).to receive(:generate_content).and_return(gemini_response)
      end

      it 'calls gemini client with constructed prompt' do
        expect(gemini_client).to receive(:generate_content).with(instance_of(String), temperature: 0.2)
        analyzer.call
      end

      it 'parses skill updates correctly' do
        result = analyzer.call
        
        expect(result[:skill_updates].size).to eq(1)
        update = result[:skill_updates].first
        expect(update[:coverage_map_id]).to eq(coverage_map.id)
        expect(update[:skill_label]).to eq('Ruby')
        expect(update[:new_state]).to eq('partial') # From StateEngine stub
        expect(update[:new_probe_count]).to eq(1)
        expect(update[:last_signal]).to eq('Mentioned Ruby')
      end

      it 'parses discovered skills correctly' do
        result = analyzer.call
        
        expect(result[:discovered_skills].size).to eq(1)
        discovered = result[:discovered_skills].first
        expect(discovered[:label]).to eq('RSpec')
        expect(discovered[:first_mention]).to eq('Mentioned testing')
      end

      context 'when gemini returns invalid JSON' do
        before do
          allow(gemini_client).to receive(:generate_content).and_return('invalid json')
        end

        it 'handles the error gracefully and returns empty results' do
          result = analyzer.call
          
          expect(result).to eq({ skill_updates: [], discovered_skills: [] })
        end
      end
      
      context 'when skill is already covered' do
        before do
          coverage_map.update!(state: 'covered')
        end
        
        it 'skips updating covered skills' do
          result = analyzer.call
          expect(result[:skill_updates]).to be_empty
        end
      end
    end
  end
end
