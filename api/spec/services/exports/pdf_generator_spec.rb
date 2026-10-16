# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Exports::PdfGenerator do
  describe '.clean_str' do
    it 'converts Unicode arrows to ASCII equivalents' do
      expect(described_class.clean_str('L3 → L4')).to eq('L3 -> L4')
      expect(described_class.clean_str('A ← B ↔ C')).to eq('A <- B <-> C')
    end

    it 'converts bullets, en-dash, and em-dash to standard hyphen' do
      expect(described_class.clean_str('• Item 1 — Item 2 – Item 3')).to eq('- Item 1 - Item 2 - Item 3')
    end

    it 'converts curly quotation marks to straight quotes' do
      expect(described_class.clean_str('“Smart Quotes” and ‘Single Quotes’')).to eq('"Smart Quotes" and \'Single Quotes\'')
    end

    it 'converts ellipsis and special indicators' do
      expect(described_class.clean_str('Processing… [✓] [✅] [✏]')).to eq('Processing... [[v]] [[Match]] [[Override]]')
    end

    it 'removes non-breaking space and zero-width spaces' do
      expect(described_class.clean_str("Hello\u00A0World\u200B")).to eq('Hello World')
    end

    it 'handles nil gracefully by returning an empty string' do
      expect(described_class.clean_str(nil)).to eq('')
    end

    it 'handles numeric and boolean values without error' do
      expect(described_class.clean_str(12345)).to eq('12345')
      expect(described_class.clean_str(true)).to eq('true')
    end

    it 'falls back to replacement character for completely unknown Unicode glyphs' do
      cleaned = described_class.clean_str('Test 🚀 Rocket')
      expect(cleaned.encoding.name).to eq('Windows-1252')
      expect(cleaned).to include('Test')
      expect(cleaned).to include('Rocket')
    end
  end

  describe '#call' do
    let(:organization) do
      Organization.find_or_create_by!(scheme: 'test-corp') do |o|
        o.name = 'Test Corp'
        o.identifier = 'test-corp'
        o.host = 'localhost'
        o.alias_hosts = []
        o.config = {}
      end
    end

    let(:assessment) do
      Assessment.create!(
        tenant_id: organization.id,
        created_by: 1,
        name: 'Senior QA Engineer Assessment',
        time_limit_min: 45
      )
    end

    let(:session) do
      Session.create!(
        tenant_id: organization.id,
        assessment_id: assessment.id,
        candidate_name: 'Budi “Tester” Pratama',
        status: 'ended',
        duration_seconds: 1420
      )
    end

    let(:portfolio) do
      Portfolio.create!(
        session_id: session.id,
        generation_status: 'complete',
        generated_at: Time.current
      )
    end

    let!(:skill_1) do
      portfolio.portfolio_skills.create!(
        skill_id: 'SK-ENG-006',
        skill_label: 'Testing & Quality Assurance',
        is_discovered: false,
        ai_level: 3,
        ai_confidence: 'high',
        evidence: [
          '“We built automated regression suites using Jest and Playwright.”',
          '• Monitored test flaky rate in CI/CD.'
        ],
        competency_summary: 'Consistently demonstrates L3 proficiency in testing frameworks.'
      )
    end

    let!(:override) do
      skill_1.create_assessor_override!(
        ai_level: 3,
        override_level: 4,
        assessor_notes: 'Exhibited exceptional architectural leadership in testing pipelines — approved by Lead Assessor.',
        overridden_by: 1,
        overridden_at: Time.current
      )
    end

    context 'when generating portfolio PDF without vacancy' do
      subject(:generator) { described_class.new(portfolio: portfolio) }

      it 'successfully renders a valid binary PDF document' do
        pdf_data = generator.call
        expect(pdf_data).to be_a(String)
        expect(pdf_data.start_with?('%PDF-')).to be true
        expect(pdf_data.bytesize).to be > 1000
      end
    end

    context 'when generating portfolio PDF with vacancy and FitGapReport' do
      let(:vacancy) do
        Vacancy.create!(
          tenant_id: organization.id,
          created_by: 1,
          role_title: 'Lead QA Engineer',
          culture_dimensions: 'Ownership-driven and direct feedback culture.'
        )
      end

      let!(:fit_gap_report) do
        FitGapReport.create!(
          portfolio_id: portfolio.id,
          vacancy_id: vacancy.id,
          skill_comparisons: [
            {
              'skill_label' => 'Testing & Quality Assurance',
              'expected_level' => 4,
              'candidate_level' => 4,
              'result' => 'match',
              'delta' => 0
            }
          ],
          culture_narrative: 'Candidate exhibits high alignment with ownership and rigorous quality standards.',
          overall_narrative: 'Strongly recommended for hire with zero gaps identified.'
        )
      end

      subject(:generator) { described_class.new(portfolio: portfolio, vacancy: vacancy) }

      it 'successfully renders a multi-page PDF containing the Fit/Gap comparison table' do
        pdf_data = generator.call
        expect(pdf_data.start_with?('%PDF-')).to be true
        expect(pdf_data.bytesize).to be > 2000
      end
    end

    context 'when candidate and session data have missing optional fields' do
      let(:incomplete_session) do
        Session.create!(
          tenant_id: organization.id,
          assessment_id: assessment.id,
          candidate_name: nil,
          status: 'ended',
          duration_seconds: nil
        )
      end

      let(:incomplete_portfolio) do
        Portfolio.create!(
          session_id: incomplete_session.id,
          generation_status: 'complete'
        )
      end

      let!(:incomplete_skill) do
        incomplete_portfolio.portfolio_skills.create!(
          skill_id: nil,
          skill_label: 'Clean Architecture',
          is_discovered: true,
          ai_level: 2,
          ai_confidence: 'medium',
          evidence: [],
          competency_summary: 'Understands basic separation of concerns.'
        )
      end

      subject(:generator) { described_class.new(portfolio: incomplete_portfolio) }

      it 'renders safely without throwing errors on nil values' do
        expect { generator.call }.not_to raise_error
        pdf_data = generator.call
        expect(pdf_data.start_with?('%PDF-')).to be true
      end
    end
  end
end
