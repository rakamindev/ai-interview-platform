# frozen_string_literal: true

require 'rails_helper'

# Perbaikan #3 (A3): level yang hilang/rusak dari respons Gemini Pro harus
# tersimpan sebagai NULL ("belum dinilai"), bukan L1. Frontend-nya sudah siap:
# parseLevel → null, LevelBadge → kotak "Unknown".
RSpec.describe Portfolios::Generator do
  let(:session)   { create(:session) }
  let(:portfolio) { nil }

  let(:client) do
    instance_double(Gemini::HttpClient, generate_content: response_body)
  end

  let(:response_body) do
    {
      'configured_skills' => [
        { 'skill_id' => 'sk-eng-001', 'skill_label' => 'React / Frontend Development',
          'level' => 3, 'confidence' => 'high', 'evidence' => %w[q1 q2 q3 q4],
          'competency_summary' => 'Solid on routine scope.' },
        # level TIDAK dikirim — dulu: nil.to_i.clamp(1,5) = L1
        { 'skill_id' => 'sk-eng-002', 'skill_label' => 'System Design',
          'confidence' => 'medium', 'evidence' => ['partial discussion'],
          'competency_summary' => 'Partial evidence only.' },
        # level di luar rentang — dulu: 99.clamp(1,5) = L5 (rating terbaik!)
        { 'skill_id' => 'sk-eng-003', 'skill_label' => 'Databases',
          'level' => 99, 'confidence' => 'low', 'evidence' => [],
          'competency_summary' => 'Garbage in the response.' }
      ],
      'discovered_skills' => [
        # "L3" string juga harus benar
        { 'skill_label' => 'Incident Triage', 'level' => 'L3', 'confidence' => 'medium',
          'evidence' => ['one quote'], 'competency_summary' => 'Discovered mid-session.' }
      ]
    }.to_json
  end

  subject(:generator) { described_class.new(session: session, gemini_client: client) }

  def reload_skills
    PortfolioSkill.order(:id).to_a
  end

  it 'menyimpan level yang valid, mengonversi "L3", dan memotong evidence ke 3' do
    generator.call
    skills = reload_skills

    expect(skills[0].ai_level).to eq(3)
    expect(skills[0].ai_confidence).to eq('high')
    expect(skills[0].evidence_quotes.length).to eq(3)
    expect(skills[3].ai_level).to eq(3) # "L3" dari discovered skills
  end

  it 'menyimpan ai_level NULL — bukan L1 — ketika level tidak dikirim' do
    generator.call
    skills = reload_skills

    expect(skills[1].skill_label).to eq('System Design')
    expect(skills[1].ai_level).to be_nil
  end

  it 'menyimpan ai_level NULL — bukan L5 — ketika level di luar rentang' do
    generator.call
    skills = reload_skills

    expect(skills[2].skill_label).to eq('Databases')
    expect(skills[2].ai_level).to be_nil
  end

  it 'menandai portfolio complete dan mengisi generated_at' do
    p = generator.call
    expect(p.generation_status).to eq('complete')
    expect(p.generated_at).to be_present
  end

  it 'idempoten: regenerasi tidak menduplikasi skill' do
    generator.call
    generator.call
    expect(PortfolioSkill.count).to eq(4)
  end
end
