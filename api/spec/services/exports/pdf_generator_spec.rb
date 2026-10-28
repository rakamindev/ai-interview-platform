# frozen_string_literal: true

require "rails_helper"

RSpec.describe Exports::PdfGenerator do
  # Regression guard: LEVEL_LABELS[nil] used to render a blank "Level: "
  # line for a not_assessed skill instead of crashing or showing something
  # honest. This just proves generation succeeds and produces real bytes —
  # asserting on PDF text content would need an extraction library this repo
  # doesn't carry.
  it "renders without error for a portfolio containing a not_assessed skill" do
    portfolio = nil
    with_tenant(1) do
      assessment = create(:assessment)
      session = create(:session, assessment: assessment)
      portfolio = create(:portfolio, session: session)
      create(:portfolio_skill, :not_assessed, portfolio: portfolio, skill_label: "Cloud Infra")
      create(:portfolio_skill, portfolio: portfolio, skill_label: "React", ai_level: 4)
    end

    pdf_bytes = nil
    expect {
      pdf_bytes = described_class.new(portfolio: portfolio).call
    }.not_to raise_error

    expect(pdf_bytes).to start_with("%PDF")
  end

  it "renders a fit/gap section including an insufficient_evidence result without error" do
    portfolio = nil
    vacancy = nil
    with_tenant(1) do
      assessment = create(:assessment)
      session = create(:session, assessment: assessment)
      portfolio = create(:portfolio, session: session)
      vacancy = create(:vacancy)
    end
    create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy, skill_comparisons: [
      { "skill_label" => "Testing", "expected_level" => 3, "candidate_level" => nil,
        "result" => "insufficient_evidence", "delta" => nil },
    ])

    expect {
      described_class.new(portfolio: portfolio, vacancy: vacancy).call
    }.not_to raise_error
  end
end
