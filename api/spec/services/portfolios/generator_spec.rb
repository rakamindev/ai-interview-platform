# frozen_string_literal: true

require 'rails_helper'

# Characterization spec: documents the current happy path with a well-formed
# model response. Failure paths are covered later, test-first, per finding.
RSpec.describe Portfolios::Generator do
  subject(:portfolio) { described_class.new(session: interview_session, gemini_client: gemini).call }

  let(:assessment)        { create(:assessment) }
  let(:interview_session) { create(:session, assessment: assessment) }
  let(:gemini) do
    FakeGeminiClient.new({
      'configured_skills' => [
        { 'skill_id' => 'sk-contoh-001', 'skill_label' => 'Ruby on Rails', 'level' => 3, 'confidence' => 'high',
          'evidence' => ['Kandidat Contoh: saya memecah migrasi besar jadi beberapa langkah.'],
          'competency_summary' => 'Contoh ringkasan Ruby on Rails.' }
      ],
      'discovered_skills' => [
        { 'skill_label' => 'Docker', 'level' => 2, 'confidence' => 'low',
          'evidence' => ['Kandidat Contoh: saya pernah membuat Dockerfile.'],
          'competency_summary' => 'Contoh ringkasan Docker.' }
      ]
    })
  end

  before do
    create(:assessment_skill, assessment: assessment, skill_label: 'Ruby on Rails')
    create(:coverage_map, session: interview_session, skill_label: 'Ruby on Rails')
    # Discovered skills get their own coverage entry from the coverage analyzer (PRD-01 section 4).
    create(:coverage_map, session: interview_session, skill_label: 'Docker', is_discovered: true,
                          state: 'partial', probe_count: 2)
    create(:transcript_turn, session: interview_session, turn_number: 1, speaker: 'ai', text: 'Contoh pertanyaan AI.')
    create(:transcript_turn, session: interview_session, turn_number: 2, text: 'Contoh jawaban tentang migrasi.')
  end

  it 'marks the portfolio complete with a generation timestamp' do
    expect(portfolio).to have_attributes(generation_status: 'complete', generated_at: be_present)
  end

  it 'stores configured skills with the level and confidence from the model' do
    skill = portfolio.portfolio_skills.find_by!(skill_label: 'Ruby on Rails')

    expect(skill).to have_attributes(skill_id: 'sk-contoh-001', is_discovered: false,
                                     ai_level: 3, ai_confidence: 'high')
  end

  it 'stores discovered skills flagged as discovered and without a skill_id' do
    skill = portfolio.portfolio_skills.find_by!(skill_label: 'Docker')

    # Confidence is computed from coverage (partial, 2 probes = medium, D-7), not taken from the model's "low".
    expect(skill).to have_attributes(skill_id: nil, is_discovered: true, ai_level: 2, ai_confidence: 'medium')
  end

  it 'sends the transcript to the model in a single call' do
    portfolio

    expect(gemini.calls.size).to eq(1)
    expect(gemini.calls.first[:prompt]).to include('Contoh jawaban tentang migrasi.')
  end
end
