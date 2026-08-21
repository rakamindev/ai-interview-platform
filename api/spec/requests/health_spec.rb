# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Health check", type: :request do
  describe "GET /health" do
    it "returns ok" do
      get "/health"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["status"]).to eq("ok")
    end
  end

  describe "GET /api/v1/health" do
    it "returns ok" do
      get "/api/v1/health"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["status"]).to eq("ok")
    end
  end
end
