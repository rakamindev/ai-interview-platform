# frozen_string_literal: true

require "rails_helper"

RSpec.describe Sessions::EndHandler do
  let(:session) { create(:session, status: "active", end_reason: nil, started_at: 5.minutes.ago) }

  describe "#call" do
    it "ends the session and creates a portfolio" do
      result = described_class.new(session).call(reason: "manual_candidate")

      expect(result.status).to eq("ended")
      expect(result.end_reason).to eq("manual_candidate")
      expect(result.portfolio).to be_present
    end

    it "is idempotent when the session is already ended" do
      session.update!(status: "ended", end_reason: "all_covered")

      expect { described_class.new(session).call(reason: "manual_candidate") }
        .not_to raise_error
    end

    it "does not raise when the session row was deleted concurrently" do
      session_id = session.id
      Session.where(id: session_id).delete_all

      expect { described_class.new(session).call(reason: "manual_candidate") }
        .not_to raise_error

      expect(Portfolio.where(session_id: session_id)).not_to exist
    end
  end
end
