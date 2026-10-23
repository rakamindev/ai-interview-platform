# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Exports::PdfGenerator do
  let(:portfolio) { create(:portfolio) }
  let(:vacancy)   { create(:vacancy) }
  let!(:skill) do
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'System Design', ai_level: 2, ai_confidence: 'low')
  end

  before { create(:vacancy_skill, vacancy: vacancy, skill_label: 'System Design', expected_level: 4) }

  def render_pdf
    described_class.new(portfolio: portfolio.reload, vacancy: vacancy).call
  end

  it 'renders a report with a skill that needs review' do
    FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: double(generate_content: {})).call

    expect(render_pdf).to start_with('%PDF')
  end

  it 'renders once an assessor has confirmed a level' do
    create(:assessor_override, portfolio_skill: skill, override_level: 4)

    expect(render_pdf).to start_with('%PDF')
  end

  it 'renders AI narrative text outside the built-in font character set' do
    create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy,
                            overall_narrative: 'Strong on data → open question on design ≥ L4 ✓')

    expect(render_pdf).to start_with('%PDF')
  end
end
