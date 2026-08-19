require "rails_helper"

RSpec.describe "Api::V1::Authentication", type: :request do
  describe "POST /api/v1/auth/login" do
    let(:password) { "SecurePass123!" }

    context "with a valid admin account" do
      let!(:admin) { create(:user, :admin, email: "admin@example.com", password: password) }

      it "returns 200 with a token and the user's public info" do
        post "/api/v1/auth/login", params: { email: "admin@example.com", password: password }, as: :json

        expect(response).to have_http_status(:ok)
        body = response.parsed_body
        expect(body["token"]).to be_present
        expect(body["user"]).to include("id" => admin.id, "email" => admin.email, "role" => "admin")
      end

      it "is case-insensitive on email" do
        post "/api/v1/auth/login", params: { email: "ADMIN@EXAMPLE.COM", password: password }, as: :json

        expect(response).to have_http_status(:ok)
      end

      it "issues a token that JsonWebToken can decode back to the same user_id" do
        post "/api/v1/auth/login", params: { email: "admin@example.com", password: password }, as: :json

        token = response.parsed_body["token"]
        decoded = JsonWebToken.decode(token)
        expect(decoded[:user_id]).to eq(admin.id)
        expect(decoded[:role]).to eq("admin")
      end
    end

    context "with a wrong password" do
      let!(:admin) { create(:user, :admin, email: "admin@example.com", password: password) }

      it "returns 401 with a generic error message" do
        post "/api/v1/auth/login", params: { email: "admin@example.com", password: "wrong-password" }, as: :json

        expect(response).to have_http_status(:unauthorized)
        expect(response.parsed_body["errors"].first["message"]).to eq("Invalid email or password")
      end
    end

    context "with an email that does not exist" do
      it "returns 401 with the same generic error message (does not reveal whether the email exists)" do
        post "/api/v1/auth/login", params: { email: "nobody@example.com", password: password }, as: :json

        expect(response).to have_http_status(:unauthorized)
        expect(response.parsed_body["errors"].first["message"]).to eq("Invalid email or password")
      end
    end

    context "with a correct password but a non-admin role" do
      let!(:regular_user) { create(:user, email: "user@example.com", password: password, role: "user") }

      it "returns 401 even though the password is correct" do
        post "/api/v1/auth/login", params: { email: "user@example.com", password: password }, as: :json

        expect(response).to have_http_status(:unauthorized)
        expect(response.parsed_body["errors"].first["message"]).to eq("Invalid email or password")
      end
    end

    context "with missing params" do
      it "returns 401 rather than raising, for a missing password" do
        post "/api/v1/auth/login", params: { email: "admin@example.com" }, as: :json

        expect(response).to have_http_status(:unauthorized)
      end

      it "returns 401 rather than raising, for a missing email" do
        post "/api/v1/auth/login", params: { password: password }, as: :json

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "parameter logging" do
      let!(:admin) { create(:user, :admin, email: "admin@example.com", password: password) }

      it "filters the password out of Rails' configured filter_parameters" do
        expect(Rails.application.config.filter_parameters).to be_any { |f| f.to_s.include?("passw") }
      end
    end
  end
end
