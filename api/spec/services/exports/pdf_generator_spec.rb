# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Exports::PdfGenerator do
  let(:assessment) { instance_double(Assessment, name: 'Senior Fullstack Engineer — Tech') }
  let(:session) do
    instance_double(
      Session,
      id: 42,
      assessment: assessment,
      candidate_name: 'Jane “Dev” Doe',
      duration_seconds: 1540
    )
  end

  let(:override) do
    instance_double(
      AssessorOverride,
      override_level: 4,
      assessor_notes: 'Strong evidence of architecture thinking → upgrade from L3'
    )
  end

  let(:skill_with_override) do
    instance_double(
      PortfolioSkill,
      skill_label: 'System Design',
      is_discovered: false,
      ai_level: 3,
      ai_confidence: 'high',
      unassessed?: false,
      assessor_override: override,
      competency_summary: 'Demonstrated solid distributed design principles: caching, CQRS & sharding.',
      evidence: ['“We scaled database replicas using read-pools”', 'Implemented queue backpressure • handled 10k RPS']
    )
  end

  let(:unassessed_skill) do
    instance_double(
      PortfolioSkill,
      skill_label: 'Docker & Kubernetes',
      is_discovered: false,
      ai_level: nil,
      ai_confidence: nil,
      unassessed?: true,
      assessor_override: nil,
      competency_summary: 'Skill was not covered during interview session.',
      evidence: []
    )
  end

  let(:discovered_skill) do
    instance_double(
      PortfolioSkill,
      skill_label: 'GraphQL Federation 🚀',
      is_discovered: true,
      ai_level: 4,
      ai_confidence: 'medium',
      unassessed?: false,
      assessor_override: nil,
      competency_summary: 'Unexpected advanced knowledge in GraphQL schema stitching.',
      evidence: ['Built federated gateway in Go']
    )
  end

  let(:portfolio_skills) { [skill_with_override, unassessed_skill, discovered_skill] }
  let(:portfolio) { instance_double(Portfolio, id: 101, session: session) }

  before do
    allow(portfolio).to receive_message_chain(:portfolio_skills, :includes).and_return(portfolio_skills)
  end

  describe '#call' do
    it 'generates a valid PDF binary string without throwing encoding errors' do
      generator = described_class.new(portfolio: portfolio)
      pdf_output = generator.call

      expect(pdf_output).to be_a(String)
      expect(pdf_output).to start_with('%PDF')
      expect(pdf_output.bytesize).to be > 1000
    end

    it 'generates PDF with FitGapReport when vacancy is provided' do
      vacancy = instance_double(Vacancy, id: 10, role_title: 'Lead Architect — Platform')
      fit_gap = instance_double(
        FitGapReport,
        skill_comparisons: [
          { 'skill_label' => 'System Design', 'expected_level' => 4, 'candidate_level' => 4, 'result' => 'match', 'delta' => 0 },
          { 'skill_label' => 'Docker & Kubernetes', 'expected_level' => 3, 'candidate_level' => nil, 'result' => 'not_assessed', 'delta' => nil }
        ],
        culture_narrative: 'Strong alignment with collaborative engineering culture.',
        overall_narrative: 'Recommended for lead role with high potential.'
      )

      allow(FitGapReport).to receive(:find_by).with(portfolio: portfolio, vacancy: vacancy).and_return(fit_gap)

      generator = described_class.new(portfolio: portfolio, vacancy: vacancy)
      pdf_output = generator.call

      expect(pdf_output).to be_a(String)
      expect(pdf_output).to start_with('%PDF')
    end

    it 'properly sanitizes incompatible UTF-8 characters like arrows, curly quotes, and emojis' do
      generator = described_class.new(portfolio: portfolio)
      sanitized = generator.send(:sanitize, 'Test “quote” with → arrow & emoji 🚀 and dash — end')
      expect(sanitized).to eq('Test "quote" with -> arrow & emoji  and dash - end')
    end
  end
end
