# frozen_string_literal: true

require "rails_helper"

RSpec.describe SessionSnapshot do
  let(:session) { create(:session) }

  it "requires image_data" do
    snapshot = described_class.new(session:, captured_at: Time.current, image_data: nil)
    expect(snapshot).not_to be_valid
  end

  it "requires captured_at" do
    snapshot = described_class.new(session:, captured_at: nil, image_data: "base64data")
    expect(snapshot).not_to be_valid
  end

  it "is valid with a session, captured_at, and image_data" do
    snapshot = described_class.new(session:, captured_at: Time.current, image_data: "base64data")
    expect(snapshot).to be_valid
  end

  describe ".purge_expired!" do
    it "deletes snapshots older than the retention period, and nothing else" do
      old = create(:session_snapshot, session:, captured_at: (SessionSnapshot::RETENTION_PERIOD + 1.day).ago)
      recent = create(:session_snapshot, session:, captured_at: 1.day.ago)

      described_class.purge_expired!

      expect(described_class.exists?(old.id)).to be false
      expect(described_class.exists?(recent.id)).to be true
    end
  end
end
