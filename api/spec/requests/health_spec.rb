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

  describe "GET /health/live" do
    it "returns ok" do
      get "/health/live"
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["status"]).to eq("ok")
    end
  end

  describe "GET /health/ready" do
    it "returns ok with db and redis checks" do
      allow(ActiveRecord::Base).to receive_message_chain(:connection, :execute) # rubocop:disable RSpec/MessageChain
      allow_any_instance_of(Redis).to receive(:ping).and_return("PONG")

      get "/health/ready"
      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body["status"]).to eq("ok")
      expect(body["checks"]["db"]).to eq("ok")
      expect(body["checks"]["redis"]).to eq("ok")
    end

    it "returns degraded when db is unreachable" do
      allow(ActiveRecord::Base).to receive_message_chain(:connection, :execute).and_raise(ActiveRecord::ConnectionNotEstablished) # rubocop:disable RSpec/MessageChain
      allow_any_instance_of(Redis).to receive(:ping).and_return("PONG")

      get "/health/ready"
      expect(response).to have_http_status(:service_unavailable)
      body = response.parsed_body
      expect(body["status"]).to eq("degraded")
      expect(body["checks"]["db"]).to start_with("error:")
      expect(body["checks"]["redis"]).to eq("ok")
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
