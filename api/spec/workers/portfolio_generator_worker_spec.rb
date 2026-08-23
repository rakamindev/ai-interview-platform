# frozen_string_literal: true

require "rails_helper"

RSpec.describe PortfolioGeneratorWorker do
  let(:assessment)  { create(:assessment) }
  let(:session)     { create(:session, assessment: assessment, status: "ended") }
  # GEMINI_STUB=true (set for this whole container) already redirects
  # Gemini::HttpClient.new to Gemini::StubClient with mode: :valid by
  # default — Portfolios::Generator's real gemini_client is already a stub.

  describe "#perform" do
    it "delegates to Portfolios::Generator" do
      expect_any_instance_of(Portfolios::Generator).to receive(:call).and_call_original

      described_class.new.perform(session.id)
    end

    it "creates a portfolio with skills" do
      create(:coverage_map, session: session, skill_label: "React / Frontend Development Core", skill_id: "SK-ENG-001")
      create(:coverage_map, session: session, skill_label: "Node.js / Backend Development", skill_id: "SK-ENG-002")
      create(:assessment_skill, assessment: assessment)
      create(:transcript_turn, session: session, speaker: "candidate", text: "I built a complex app.")

      expect do
        described_class.new.perform(session.id)
      end.to change(Portfolio, :count)
    end

    it "logs and returns nil when session not found" do
      expect(Rails.logger).to receive(:warn).with(/not found/)

      result = described_class.new.perform(-1)
      expect(result).to be_nil
    end
  end

  describe "sidekiq configuration" do
    it "uses the portfolio queue" do
      expect(described_class.sidekiq_options["queue"]).to eq(:portfolio)
    end

    it "retries 3 times" do
      expect(described_class.sidekiq_options["retry"]).to eq(3)
    end
  end
end
