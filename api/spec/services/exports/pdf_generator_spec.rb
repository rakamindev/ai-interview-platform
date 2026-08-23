# frozen_string_literal: true

require "rails_helper"

RSpec.describe Exports::PdfGenerator do
  let(:assessment) { create(:assessment) }
  let(:session)    { create(:session, assessment: assessment, status: "ended") }
  let(:portfolio)  { create(:portfolio, session: session) }

  subject(:generator) { described_class.new(portfolio: portfolio) }

  before do
    create(:portfolio_skill,
           portfolio: portfolio,
           skill_label: "Indonesian Communication",
           competency_summary: "Candra explained “kami sudah menyelesaikan proyek itu” with an em-dash—clarity was excellent.",
           evidence: [
             "Candidate used “itu benar” and “memang begitu” naturally.",
             "Responded with “tidak masalah”—then elaborated in detail."
           ])
  end

  # AC-8.1: Indonesian text with typographic quotes and em-dashes renders without error
  describe "AC-8.1 — Indonesian Unicode text" do
    it "renders Indonesian candidate quotes without raising" do
      expect { generator.call }.not_to raise_error
    end

    it "returns a valid PDF byte string" do
      pdf_bytes = generator.call

      expect(pdf_bytes).to be_a(String)
      expect(pdf_bytes.byteslice(0, 4)).to eq("%PDF")
    end
  end

  describe "candidate name in header" do
    it "includes the candidate name in the PDF" do
      pdf_bytes = generator.call
      hex_name = session.candidate_name.unpack1("H*")

      expect(pdf_bytes).to include(hex_name)
    end
  end
end
