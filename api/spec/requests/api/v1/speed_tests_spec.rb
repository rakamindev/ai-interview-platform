# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Speed test endpoints", type: :request do
  it "returns a cache-resistant ping response without authentication" do
    get "/api/v1/speed_test/ping"

    expect(response).to have_http_status(:ok)
    expect(response.headers["Cache-Control"]).to include("no-store")
    expect(JSON.parse(response.body)).to include("status" => "ok")
  end

  it "returns bytes received for upload payload without authentication" do
    payload = "speed-test-payload"

    post "/api/v1/speed_test/upload",
         params: payload,
         headers: { "CONTENT_TYPE" => "application/octet-stream" }

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)).to include("received_bytes" => payload.bytesize)
  end

  it "rejects oversized upload payloads" do
    payload = "x" * (Api::V1::SpeedTestsController::MAX_UPLOAD_BYTES + 1)

    post "/api/v1/speed_test/upload",
         params: payload,
         headers: { "CONTENT_TYPE" => "application/octet-stream" }

    expect(response).to have_http_status(:payload_too_large)
    expect(JSON.parse(response.body).dig("errors", 0, "status")).to eq(413)
  end
end
