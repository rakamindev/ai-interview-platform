# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Exports::PdfGenerator do
  let(:org) { create(:organization, name: 'Test Org', scheme: 'test-corp', identifier: 'test-corp', host: 'localhost') }
  let(:assessment) { create(:assessment, tenant_id: org.id, name: 'Senior Fullstack Engineer — Core') }
  let(:session) { create(:session, tenant_id: org.id, assessment: assessment, candidate_name: 'John Doe — Candidate') }
  let(:portfolio) { create(:portfolio, session: session, generation_status: 'complete') }
  let(:portfolio_skill) do
    create(
      :portfolio_skill,
      portfolio: portfolio,
      skill_label: 'React / Frontend Development Core',
      ai_level: 2,
      ai_confidence: 'high',
      competency_summary: 'Demonstrates solid React knowledge with hooks and state.',
      evidence: [
        { 'text' => 'Menggunakan useState dan useCallback untuk optimasi render.', 'turn_number' => 4 },
        { 'text' => 'State dikelola secara lokal pada komponen utama.', 'turn_number' => 7 }
      ]
    )
  end

  let!(:assessor_override) do
    create(
      :assessor_override,
      portfolio_skill: portfolio_skill,
      override_level: 4,
      assessor_notes: 'Strong practical experience with memoization and custom hooks.'
    )
  end

  let(:vacancy) { create(:vacancy, tenant_id: org.id, role_title: 'Lead Frontend Developer') }
  let!(:fit_gap_report) do
    create(
      :fit_gap_report,
      portfolio: portfolio,
      vacancy: vacancy,
      skill_comparisons: [
        {
          'skill_label' => 'React / Frontend Development Core',
          'expected_level' => 3,
          'candidate_level' => 4,
          'ai_level' => 2,
          'is_override' => true,
          'result' => 'exceed',
          'delta' => 1,
          'assessor_notes' => 'Candidate exceeded expectations during deep-dive.'
        }
      ],
      culture_narrative: 'Candidate exhibits great learning agility and clear communication.',
      overall_narrative: 'Recommended for Senior/Lead level based on overridden evaluation.'
    )
  end

  describe '#call' do
    it 'generates a valid binary PDF with overridden skill and fit/gap analysis' do
      generator = described_class.new(portfolio: portfolio, vacancy: vacancy)
      pdf_data = generator.call

      expect(pdf_data).to be_a(String)
      expect(pdf_data.bytesize).to be > 1000
      expect(pdf_data[0..3]).to eq('%PDF')
    end

    it 'safely handles special Unicode characters and arrows without encoding errors' do
      portfolio_skill.update!(
        competency_summary: 'Arrow → right, em-dash — dash, smart quotes “quotes” and emoji 🚀'
      )

      generator = described_class.new(portfolio: portfolio, vacancy: vacancy)
      expect { generator.call }.not_to raise_error
    end
  end
end
