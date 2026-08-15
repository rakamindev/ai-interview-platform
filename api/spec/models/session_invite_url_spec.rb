# frozen_string_literal: true

require "rails_helper"

# assessment/gap-analysis.md P0-6: invite_url was built from APP_BASE_URL
# (the backend's own address) even though /interview/:token is a frontend
# route — every "Copy link" sent the assessor a link the candidate could
# never open.
RSpec.describe Session, type: :model do
  describe "#invite_url" do
    around do |example|
      original = ENV["FRONTEND_BASE_URL"]
      example.run
      ENV["FRONTEND_BASE_URL"] = original
    end

    it "points at FRONTEND_BASE_URL, not the backend's own address" do
      ENV["FRONTEND_BASE_URL"] = "https://candidate.example.com"
      session = create(:session)

      expect(session.invite_url).to eq("https://candidate.example.com/interview/#{session.invite_token}")
    end

    it "defaults to the local Vite dev server when unset" do
      ENV.delete("FRONTEND_BASE_URL")
      session = create(:session)

      expect(session.invite_url).to start_with("http://localhost:5173/interview/")
    end
  end
end
