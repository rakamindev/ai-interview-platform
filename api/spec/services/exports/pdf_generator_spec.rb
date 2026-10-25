# frozen_string_literal: true

require 'bundler/setup'
require 'pathname'

module Rails
  def self.root
    Pathname.new(File.expand_path('../../..', __dir__))
  end
end

require_relative '../../../app/services/exports/pdf_generator'

RSpec.describe Exports::PdfGenerator do
  subject(:pdf) { described_class.new(portfolio: portfolio).call }

  let(:assessment) { instance_double('Assessment', name: "Senior Frontend — Engineer → 日本語") }
  let(:session) do
    instance_double(
      'Session',
      assessment: assessment,
      id: 42,
      duration_seconds: nil
    )
  end
  let(:long_summary) { "Candidate summary • " + ("Unicode text — with arrows → and bullets • " * 100) }
  let(:skill) do
    instance_double(
      'PortfolioSkill',
      is_discovered: false,
      assessor_override: nil,
      ai_level: 4,
      ai_confidence: 'medium',
      skill_label: 'Communication → 日本語',
      competency_summary: long_summary,
      evidence: [],
      assessor_notes: nil
    )
  end
  let(:skills_scope) { instance_double('PortfolioSkillsAssociation') }
  let(:portfolio) do
    instance_double(
      'Portfolio',
      session: session,
      portfolio_skills: skills_scope
    )
  end

  before do
    allow(skills_scope).to receive(:includes).with(:assessor_override).and_return([skill])
  end

  it 'generates a PDF for empty optional fields, long text, and Unicode characters' do
    expect { pdf }.not_to raise_error
    expect(pdf).to start_with('%PDF-')
  end
end
