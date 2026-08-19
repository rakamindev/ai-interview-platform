# frozen_string_literal: true

require "rails_helper"

RSpec.describe Exports::PdfGenerator do
  let(:organization) { create(:organization) }
  let(:assessment)   { create(:assessment, organization:) }
  let(:session)      { create(:session, assessment:) }
  let(:portfolio)    { create(:portfolio, session:, generation_status: "complete") }

  it "renders a portfolio containing a not_assessed skill without crashing" do
    create(:portfolio_skill, :not_assessed, portfolio:)

    pdf_binary = described_class.new(portfolio:).call

    expect(pdf_binary).to be_a(String)
    expect(pdf_binary).not_to be_empty
  end
end
