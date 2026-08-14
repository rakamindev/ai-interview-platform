# frozen_string_literal: true

require "rails_helper"

# assessment/gap-analysis.md P1-4: invite_token never expired at all.
RSpec.describe Session, type: :model do
  describe "#invite_expired?" do
    it "is false for a fresh pending invite" do
      session = create(:session, status: "pending", created_at: 1.day.ago)
      expect(session.invite_expired?).to be false
    end

    it "is true for a pending invite older than the TTL" do
      session = create(:session, status: "pending", created_at: 8.days.ago)
      expect(session.invite_expired?).to be true
    end

    it "is false for an active session even past the TTL — an interview in progress must not be invalidated" do
      session = create(:session, status: "active", created_at: 8.days.ago)
      expect(session.invite_expired?).to be false
    end

    it "is false for an already-ended session even past the TTL" do
      session = create(:session, status: "ended", created_at: 8.days.ago)
      expect(session.invite_expired?).to be false
    end
  end
end
