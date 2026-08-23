# frozen_string_literal: true

require "rails_helper"

RSpec.describe AudioWebSocketMiddleware::ExternalEndSignal do
  describe ".parse" do
    it "returns the end reason for a session_status ended message" do
      msg = { type: "session_status", status: "ended", end_reason: "manual_assessor" }.to_json
      expect(described_class.parse(msg)).to eq("manual_assessor")
    end

    it "defaults to manual_assessor when no reason is given" do
      msg = { type: "session_status", status: "ended" }.to_json
      expect(described_class.parse(msg)).to eq("manual_assessor")
    end

    it "ignores a status update that isn't ended" do
      msg = { type: "session_status", status: "active" }.to_json
      expect(described_class.parse(msg)).to be_nil
    end

    it "ignores unrelated message types" do
      msg = { type: "coverage_update", skills: [] }.to_json
      expect(described_class.parse(msg)).to be_nil
    end

    it "ignores malformed JSON" do
      expect(described_class.parse("not json")).to be_nil
    end
  end
end
