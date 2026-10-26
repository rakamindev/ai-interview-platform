# frozen_string_literal: true

require "rails_helper"

RSpec.describe Session, type: :model do
  it "builds a frontend invite URL from APP_BASE_URL" do
    original_base_url = ENV["APP_BASE_URL"]
    ENV["APP_BASE_URL"] = "http://localhost:5173"

    begin
      session = described_class.new(invite_token: "test-token")

      expect(session.invite_url).to eq("http://localhost:5173/interview/test-token")
    ensure
      ENV["APP_BASE_URL"] = original_base_url
    end
  end
end
