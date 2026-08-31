require 'rails_helper'

RSpec.describe "Authentications", type: :request do
  describe "POST /api/v1/auth/login" do
    let(:valid_credentials) do
      {
        email: 'admin@test.com',
        password: 'password123'
      }
    end

    let(:invalid_credentials) do
      {
        email: 'admin@test.com',
        password: 'wrongpassword'
      }
    end

    let(:headers) do
      {
        "Content-Type" => "application/json"
      }
    end

    before do
      # Set Current.organization for tenant resolution
      test_org = Organization.first
      RequestStore.store[:organization] = test_org
      Current.organization = test_org
      Current.tenant_id = test_org.id

      # Create test users
      User.create!(email: 'admin@test.com', password: 'password123', role: 'admin')
      User.create!(email: 'user@test.com', password: 'password123', role: 'user')
    end

    after do
      # Reset RSpec mocks
      RSpec::Mocks.space.proxy_for(ApplicationController).reset if defined?(RSpec)
      RequestStore.clear!
    end

    context "with valid credentials" do
      it "returns a successful response with token" do
        post "/api/v1/auth/login", params: valid_credentials.to_json, headers: headers

        expect(response).to have_http_status(:ok)

        json_response = JSON.parse(response.body)
        expect(json_response).to have_key('token')
        expect(json_response['user']['email']).to eq('admin@test.com')
        expect(json_response['user']['role']).to eq('admin')
      end

      it "returns successful response for user role" do
        user_credentials = { email: 'user@test.com', password: 'password123' }
        post "/api/v1/auth/login", params: user_credentials.to_json, headers: headers

        expect(response).to have_http_status(:ok)

        json_response = JSON.parse(response.body)
        expect(json_response).to have_key('token')
        expect(json_response['user']['email']).to eq('user@test.com')
        expect(json_response['user']['role']).to eq('user')
      end

      it "returns valid JWT token structure" do
        post "/api/v1/auth/login", params: valid_credentials.to_json, headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response['token']).to be_a(String)
        expect(json_response['token'].length).to be > 20
      end

      it "includes user id in response" do
        post "/api/v1/auth/login", params: valid_credentials.to_json, headers: headers

        json_response = JSON.parse(response.body)
        admin = User.find_by(email: 'admin@test.com')
        expect(json_response['user']['id']).to eq(admin.id)
      end

      it "handles case-insensitive email" do
        case_insensitive_credentials = valid_credentials.merge(email: 'ADMIN@TEST.COM')
        post "/api/v1/auth/login", params: case_insensitive_credentials.to_json, headers: headers

        expect(response).to have_http_status(:ok)

        json_response = JSON.parse(response.body)
        expect(json_response['user']['email']).to eq('admin@test.com')
      end

      it "returns JSON content type" do
        post "/api/v1/auth/login", params: valid_credentials.to_json, headers: headers

        expect(response.content_type).to include('application/json')
      end
    end

    context "with invalid credentials" do
      it "returns unauthorized response for wrong password" do
        post "/api/v1/auth/login", params: invalid_credentials.to_json, headers: headers

        expect(response).to have_http_status(:unauthorized)

        json_response = JSON.parse(response.body)
        expect(json_response['errors'][0]['message']).to eq('Invalid email or password')
      end

      it "returns unauthorized response for non-existent email" do
        non_existent_credentials = { email: 'nonexistent@test.com', password: 'password123' }
        post "/api/v1/auth/login", params: non_existent_credentials.to_json, headers: headers

        expect(response).to have_http_status(:unauthorized)

        json_response = JSON.parse(response.body)
        expect(json_response['errors'][0]['message']).to eq('Invalid email or password')
      end

      it "returns successful response for non-admin user" do
        non_admin_credentials = { email: 'user@test.com', password: 'password123' }
        post "/api/v1/auth/login", params: non_admin_credentials.to_json, headers: headers

        expect(response).to have_http_status(:ok)

        json_response = JSON.parse(response.body)
        expect(json_response['user']['role']).to eq('user')
      end
    end

    context "with missing parameters" do
      it "returns unauthorized response when email is missing" do
        missing_email = { password: 'password123' }
        post "/api/v1/auth/login", params: missing_email.to_json, headers: headers

        expect(response).to have_http_status(:unauthorized)
      end

      it "returns unauthorized response when password is missing" do
        missing_password = { email: 'admin@test.com' }
        post "/api/v1/auth/login", params: missing_password.to_json, headers: headers

        expect(response).to have_http_status(:unauthorized)
      end

      it "returns unauthorized response when both parameters are missing" do
        post "/api/v1/auth/login", params: {}.to_json, headers: headers

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with empty parameters" do
      it "returns unauthorized response for empty email" do
        empty_email = { email: '', password: 'password123' }
        post "/api/v1/auth/login", params: empty_email.to_json, headers: headers

        expect(response).to have_http_status(:unauthorized)
      end

      it "returns unauthorized response for empty password" do
        empty_password = { email: 'admin@test.com', password: '' }
        post "/api/v1/auth/login", params: empty_password.to_json, headers: headers

        expect(response).to have_http_status(:unauthorized)
      end

      it "returns unauthorized response for nil email" do
        nil_email = { email: nil, password: 'password123' }
        post "/api/v1/auth/login", params: nil_email.to_json, headers: headers

        expect(response).to have_http_status(:unauthorized)
      end

      it "returns unauthorized response for nil password" do
        nil_password = { email: 'admin@test.com', password: nil }
        post "/api/v1/auth/login", params: nil_password.to_json, headers: headers

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with malformed email" do
      it "returns unauthorized response for invalid email format" do
        malformed_email = { email: 'invalid-email', password: 'password123' }
        post "/api/v1/auth/login", params: malformed_email.to_json, headers: headers

        expect(response).to have_http_status(:unauthorized)
      end

      it "returns unauthorized response for email without domain" do
        no_domain_email = { email: 'admin@', password: 'password123' }
        post "/api/v1/auth/login", params: no_domain_email.to_json, headers: headers

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with tenant scheme header" do
      it "uses X-Tenant-Scheme header when provided" do
        tenant_headers = headers.merge('X-Tenant-Scheme' => 'custom-scheme')
        post "/api/v1/auth/login", params: valid_credentials.to_json, headers: tenant_headers

        expect(response).to have_http_status(:ok)

        json_response = JSON.parse(response.body)
        expect(json_response).to have_key('token')
      end

      it "works without X-Tenant-Scheme header" do
        post "/api/v1/auth/login", params: valid_credentials.to_json, headers: headers

        expect(response).to have_http_status(:ok)

        json_response = JSON.parse(response.body)
        expect(json_response).to have_key('token')
      end
    end

    context "security considerations" do
      it "handles SQL injection attempt in email" do
        sql_injection_credentials = { email: "admin@test.com' OR '1'='1", password: 'password123' }
        post "/api/v1/auth/login", params: sql_injection_credentials.to_json, headers: headers

        expect(response).to have_http_status(:unauthorized)
      end

      it "handles very long email address" do
        long_email = "a" * 255 + "@test.com"
        long_email_credentials = { email: long_email, password: 'password123' }
        post "/api/v1/auth/login", params: long_email_credentials.to_json, headers: headers

        expect(response).to have_http_status(:unauthorized)
      end

      it "handles very long password" do
        long_password = "a" * 1000
        long_password_credentials = { email: 'admin@test.com', password: long_password }
        post "/api/v1/auth/login", params: long_password_credentials.to_json, headers: headers

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "response structure validation" do
      it "returns consistent error structure" do
        post "/api/v1/auth/login", params: invalid_credentials.to_json, headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response).to have_key('errors')
        expect(json_response['errors']).to be_an(Array)
        expect(json_response['errors'].first).to have_key('message')
      end

      it "returns consistent success structure" do
        post "/api/v1/auth/login", params: valid_credentials.to_json, headers: headers

        json_response = JSON.parse(response.body)
        expect(json_response).to have_key('token')
        expect(json_response).to have_key('user')
        expect(json_response['user']).to have_key('id')
        expect(json_response['user']).to have_key('email')
        expect(json_response['user']).to have_key('role')
      end
    end
  end
end
