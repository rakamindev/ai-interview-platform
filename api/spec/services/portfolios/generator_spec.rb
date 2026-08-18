# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  subject(:generate) { described_class.new(session: session, gemini_client: gemini).call }

  let(:assessment) { create(:assessment, time_limit_min: 10) }
  let(:session)    { create(:session, :ended, assessment: assessment) }
  let(:gemini)     { instance_double(Gemini::HttpClient, generate_content: model_response) }

  # The model rates every configured skill it is given, whether or not the
  # interview ever reached it.
  let(:model_response) do
    {
      'configured_skills' => [
        { 'skill_id' => 'sk-1', 'skill_label' => 'Probed Skill', 'level' => 3,
          'confidence' => 'low', 'evidence' => ['a real quote', 'another'],
          'competency_summary' => 'Handles routine work.' },
        { 'skill_id' => 'sk-2', 'skill_label' => 'Never Probed', 'level' => 2,
          'confidence' => 'low', 'evidence' => ['a quote borrowed from elsewhere'],
          'competency_summary' => 'Invented summary.' }
      ],
      'discovered_skills' => []
    }
  end

  def skill(label) = session.portfolio.portfolio_skills.find_by(skill_label: label)

  describe 'a skill the interview never probed' do
    before do
      create(:coverage_map, :covered,   session: session, skill_label: 'Probed Skill')
      create(:coverage_map, :untouched, session: session, skill_label: 'Never Probed')
      generate
    end

    it 'is recorded as unassessed rather than given the level the model invented' do
      expect(skill('Never Probed')).to have_attributes(
        assessed: false, ai_level: nil, ai_confidence: nil, competency_summary: nil
      )
    end

    it 'carries no evidence, so no quote is attributed to a topic never discussed' do
      expect(skill('Never Probed').evidence_quotes).to be_empty
    end

    it 'still keeps the skill on the portfolio so the gap is visible' do
      expect(session.portfolio.portfolio_skills.pluck(:skill_label))
        .to include('Never Probed')
    end

    it 'leaves a genuinely probed skill fully rated' do
      expect(skill('Probed Skill')).to have_attributes(assessed: true, ai_level: 3)
    end
  end

  describe 'confidence' do
    # PRD-01 §5: high = probe_count >= 3 AND covered; medium = probe_count == 2
    # OR partial; low otherwise. The model returned 'low' for every skill below.
    {
      [:covered, 3]   => 'high',
      [:partial, 2]   => 'medium',
      [:initiated, 1] => 'low'
    }.each do |(state_trait, probes), expected|
      it "is #{expected} when coverage is #{state_trait} with #{probes} probe(s)" do
        create(:coverage_map, state_trait, session: session,
                                           skill_label: 'Probed Skill', probe_count: probes)
        create(:coverage_map, :untouched, session: session, skill_label: 'Never Probed')
        generate

        expect(skill('Probed Skill').ai_confidence).to eq(expected)
      end
    end

    it 'is computed from coverage, not taken from the model response' do
      create(:coverage_map, :covered, session: session,
                                      skill_label: 'Probed Skill', probe_count: 4)
      create(:coverage_map, :untouched, session: session, skill_label: 'Never Probed')
      generate

      expect(skill('Probed Skill').ai_confidence).to eq('high')
    end
  end

  # Observed in session 3: one run wrote seven skills and completed; a later
  # sibling run hit a 503 and left the record marked 'failed'. The results were
  # intact in the database and invisible in the product.
  describe 'a duplicate run against an already complete portfolio' do
    before do
      create(:coverage_map, :covered,   session: session, skill_label: 'Probed Skill')
      create(:coverage_map, :untouched, session: session, skill_label: 'Never Probed')
      generate
      session.reload
    end

    it 'leaves the portfolio complete' do
      described_class.new(session: session, gemini_client: gemini).call

      expect(session.reload.portfolio).to be_complete
    end

    it 'does not call the model again' do
      expect(gemini).to have_received(:generate_content).once

      described_class.new(session: session, gemini_client: gemini).call

      expect(gemini).to have_received(:generate_content).once
    end

    it 'keeps the skills that were already written' do
      expect { described_class.new(session: session, gemini_client: gemini).call }
        .not_to change { session.reload.portfolio.portfolio_skills.count }
    end

    it 'does not mark it failed when the duplicate run would have raised' do
      failing = instance_double(Gemini::HttpClient)
      allow(failing).to receive(:generate_content)
        .and_raise(Gemini::HttpClient::ApiError.new('API returned 503'))

      described_class.new(session: session, gemini_client: failing).call

      expect(session.reload.portfolio).to be_complete
    end

    it 'still regenerates once the status is deliberately reset' do
      session.portfolio.update!(generation_status: 'pending')

      described_class.new(session: session, gemini_client: gemini).call

      expect(gemini).to have_received(:generate_content).twice
    end
  end

  # save_skills deletes before it writes. Committed separately, a failure in
  # between leaves the portfolio with nothing and nothing to restore from.
  describe 'when writing the new skills fails partway' do
    let(:broken_response) do
      {
        'configured_skills' => [
          { 'skill_id' => 'sk-1', 'skill_label' => 'Probed Skill', 'level' => 3,
            'confidence' => 'high', 'evidence' => ['quote'],
            'competency_summary' => 'Fine.' },
          # No skill_label — fails validation on insert.
          { 'skill_id' => 'sk-2', 'level' => 2, 'confidence' => 'low',
            'evidence' => [], 'competency_summary' => 'Broken row.' }
        ],
        'discovered_skills' => []
      }
    end

    before do
      create(:coverage_map, :covered, session: session, skill_label: 'Probed Skill')
      generate
      session.reload
      session.portfolio.update!(generation_status: 'pending')
      allow(gemini).to receive(:generate_content).and_return(broken_response)
    end

    it 'raises' do
      expect { described_class.new(session: session, gemini_client: gemini).call }
        .to raise_error(ActiveRecord::RecordInvalid)
    end

    it 'leaves the previous skills intact rather than an empty portfolio' do
      expect do
        described_class.new(session: session, gemini_client: gemini).call
      rescue ActiveRecord::RecordInvalid
        nil
      end.not_to change { session.reload.portfolio.portfolio_skills.count }
    end
  end

  describe 'a discovered skill' do
    let(:model_response) do
      { 'configured_skills' => [],
        'discovered_skills' => [
          { 'skill_label' => 'Docker', 'level' => 2, 'confidence' => 'high',
            'evidence' => ['mentioned Docker'], 'competency_summary' => 'Uses containers.' }
        ] }
    end

    it 'is rated when it was actually probed' do
      create(:coverage_map, :discovered, session: session, skill_label: 'Docker')
      generate

      expect(skill('Docker')).to have_attributes(assessed: true, is_discovered: true,
                                                 ai_confidence: 'low')
    end
  end
end
