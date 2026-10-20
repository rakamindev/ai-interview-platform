# frozen_string_literal: true

require 'rails_helper'

# N14: the PDF is what leaves the building, so it must render for every
# portfolio an assessor can produce. Text is checked loosely (Prawn may split
# words for kerning); what matters most is that it renders at all.
RSpec.describe Exports::PdfGenerator do
  let(:session)   { create(:session, :ended) }
  let(:portfolio) { create(:portfolio, session:) }
  let(:vacancy)   { create(:vacancy) }

  def render_pdf(vacancy: nil) = described_class.new(portfolio: portfolio.reload, vacancy:).call

  def page_count(pdf) = pdf.scan(%r{/Type /Page\b}).size

  it 'renders a one-page PDF for a simple portfolio' do
    create(:portfolio_skill, portfolio:, skill_label: 'React', ai_level: 3)

    pdf = render_pdf

    expect(pdf).to start_with('%PDF-')
    expect(page_count(pdf)).to eq(1)
  end

  it 'adds the fit/gap table on its own page when a report exists for the vacancy' do
    create(:portfolio_skill, portfolio:, skill_label: 'React', ai_level: 3)
    create(:fit_gap_report, portfolio:, vacancy:, skill_comparisons: [
             { skill_label: 'React', expected_level: 3, candidate_level: 3, result: 'match', delta: 0 },
             { skill_label: 'Communication', expected_level: 3, candidate_level: nil, result: 'not_assessed', delta: nil }
           ])

    expect(page_count(render_pdf(vacancy:))).to eq(2)
  end

  it 'leaves out the fit/gap page when no report exists for the vacancy' do
    create(:portfolio_skill, portfolio:)

    expect(page_count(render_pdf(vacancy:))).to eq(1)
  end

  it 'renders a portfolio with no skills and a session with no duration' do
    session.update!(duration_seconds: nil)

    expect(render_pdf).to start_with('%PDF-')
  end

  it 'flows very long summaries and quotes onto more pages instead of failing' do
    create(:portfolio_skill, portfolio:, competency_summary: 'Detailed. ' * 2_000, evidence: ['A long quote. ' * 300] * 3)

    expect(page_count(render_pdf)).to be > 1
  end

  it 'renders Indonesian text and the punctuation people type' do
    create(:portfolio_skill, portfolio:, skill_label: 'Komunikasi',
                             competency_summary: 'Menjelaskan “trade-off” dengan jelas — terutama saat review.',
                             evidence: ['Saya bikin one-pager… lalu share di Slack • sebelum meeting'])

    expect(render_pdf).to start_with('%PDF-')
  end

  it 'labels a skill that was not assessed as such, with no level or confidence' do
    create(:portfolio_skill, portfolio:, skill_label: 'Communication', ai_level: nil, ai_confidence: nil,
                             competency_summary: nil, evidence: [], not_assessed_reason: 'not_reached')
    lines = []
    allow_any_instance_of(Prawn::Document).to receive(:text).and_wrap_original do |original, string, *args, **opts|
      lines << string
      original.call(string, *args, **opts)
    end

    render_pdf

    expect(lines).to include('Level: Not assessed')
    expect(lines.grep(/Confidence/)).to be_empty
  end

  describe 'characters outside Windows-1252 (P1-13)' do
    it 'exports a portfolio the assessor has overridden' do
      skill = create(:portfolio_skill, portfolio:, ai_level: 2)
      create(:assessor_override, portfolio_skill: skill, override_level: 3, assessor_notes: 'Strong follow-up.')

      expect { render_pdf }.not_to raise_error
    end

    it 'shows the AI level and the override in plain characters' do
      skill = create(:portfolio_skill, portfolio:, ai_level: 2, ai_confidence: 'medium')
      create(:assessor_override, portfolio_skill: skill, override_level: 3, assessor_notes: 'Strong follow-up.')
      lines = []
      allow_any_instance_of(Prawn::Document).to receive(:text).and_wrap_original do |original, string, *args, **opts|
        lines << string
        original.call(string, *args, **opts)
      end

      render_pdf

      expect(lines).to include('Level: L3 (AI: L2 -> Override: L3)  |  Confidence: Medium')
    end

    it 'exports evidence containing characters outside Windows-1252, such as emoji' do
      create(:portfolio_skill, portfolio:, evidence: ['We shipped it 🚀 and the team said ありがとう'])

      expect { render_pdf }.not_to raise_error
    end

    it 'keeps the Windows-1252 punctuation and marks only what the font cannot show' do
      create(:portfolio_skill, portfolio:, evidence: ['“Siap” — shipped 🚀'])
      lines = []
      allow_any_instance_of(Prawn::Document).to receive(:text).and_wrap_original do |original, string, *args, **opts|
        lines << string
        original.call(string, *args, **opts)
      end

      render_pdf

      expect(lines).to include('  • “Siap” — shipped ?')
    end
  end
end
