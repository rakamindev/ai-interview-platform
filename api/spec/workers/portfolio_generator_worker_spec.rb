# frozen_string_literal: true

require "rails_helper"

RSpec.describe PortfolioGeneratorWorker do
  let(:assessment) { create(:assessment) }
  let(:session)    { create(:session, assessment:) }

  describe "session no longer exists" do
    it "skips without raising" do
      expect { described_class.new.perform(-1) }.not_to raise_error
    end
  end

  describe "a generation is already in progress for this session" do
    it "skips without raising and without touching the portfolio" do
      portfolio = session.create_portfolio!(generation_status: "generating")

      expect { described_class.new.perform(session.id) }.not_to raise_error
      expect(portfolio.reload.generation_status).to eq("generating")
    end
  end
end
