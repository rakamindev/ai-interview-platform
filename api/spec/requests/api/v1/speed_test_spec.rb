# frozen_string_literal: true

require "rails_helper"

# assessment/gap-analysis.md P0-5: the hardware check must measure against
# this platform's own infrastructure, not third-party CDNs. These two
# endpoints are what the frontend now targets by default.
RSpec.describe "Api::V1::SpeedTest", type: :request do
  describe "GET /api/v1/speed_test/download" do
    it "returns a fixed-size payload with no authentication required" do
      get "/api/v1/speed_test/download"

      expect(response).to have_http_status(:ok)
      expect(response.body.bytesize).to eq(500_000)
      expect(response.content_type).to eq("application/octet-stream")
    end
  end

  describe "POST /api/v1/speed_test" do
    it "reports back how many bytes it received, with no authentication required" do
      payload = "a" * 12_345

      post "/api/v1/speed_test", params: payload, headers: { "Content-Type" => "application/octet-stream" }

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["received_bytes"]).to eq(12_345)
    end
  end
end
