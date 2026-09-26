# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Authentication", type: :request do
  let(:organization) { create(:organization) }
  let(:tenant_header) { { "X-Tenant-Scheme" => organization.scheme } }
  let!(:admin) { create(:user, email: "admin@example.com", password: "password123", role: "admin", organization_id: organization.id) }

  def login(email, password)
    post "/api/v1/auth/login", params: { email: email, password: password }, headers: tenant_header
  end

  it "returns a token for valid admin credentials" do
    login("admin@example.com", "password123")

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)["token"]).to be_present
  end

  it "is case-insensitive on email" do
    login("ADMIN@example.com", "password123")

    expect(response).to have_http_status(:ok)
  end

  it "rejects a wrong password with a generic message" do
    login("admin@example.com", "wrong")

    expect(response).to have_http_status(:unauthorized)
    expect(response.body).not_to include("password123")
  end

  it "gives the same response for an unknown email (no account enumeration)" do
    login("admin@example.com", "wrong")
    known = response.body
    login("ghost@example.com", "wrong")

    expect(response).to have_http_status(:unauthorized)
    expect(response.body).to eq(known)
  end

  it "rejects a non-admin user" do
    create(:user, email: "viewer@example.com", password: "password123", role: "user")

    login("viewer@example.com", "password123")

    expect(response).to have_http_status(:unauthorized)
  end

  it "rejects a deactivated admin at login, not only on later requests" do
    admin.update!(active: false)

    login("admin@example.com", "password123")

    expect(response).to have_http_status(:unauthorized)
  end

  it "does not blow up on missing params" do
    post "/api/v1/auth/login", headers: tenant_header

    expect(response).to have_http_status(:unauthorized)
  end

  describe "tenant resolution" do
    it "refuses to log in when no tenant can be resolved, instead of picking the first organization" do
      create(:organization)

      post "/api/v1/auth/login", params: { email: "admin@example.com", password: "password123" }

      expect(response).to have_http_status(:forbidden)
      expect(response.body).not_to include("token")
    end

    it "refuses an unknown tenant scheme" do
      post "/api/v1/auth/login", params: { email: "admin@example.com", password: "password123" },
                                 headers: { "X-Tenant-Scheme" => "does-not-exist" }

      expect(response).to have_http_status(:forbidden)
    end

    it "issues a token scoped to the tenant that was asked for, not the first organization" do
      create(:organization, name: "AAA First", scheme: "aaa-first", identifier: "aaa-first", host: "aaa-first.example.com")
      login("admin@example.com", "password123")

      claims = JsonWebToken.decode(JSON.parse(response.body)["token"])
      expect(claims[:scheme]).to eq(organization.scheme)
    end

    it "resolves the tenant from the browser's Referer host (what the web app sends)" do
      post "/api/v1/auth/login", params: { email: "admin@example.com", password: "password123" },
                                 headers: { "Referer" => "https://#{organization.host}/login" }

      expect(response).to have_http_status(:ok)
    end
  end

  describe "tenant-bound admins" do
    let(:other_org) { create(:organization) }

    it "does not let an admin of another tenant log in under this tenant" do
      admin.update!(organization_id: other_org.id)

      login("admin@example.com", "password123")

      expect(response).to have_http_status(:unauthorized)
      expect(response.body).not_to include("token")
    end

    it "fails closed for a legacy admin that is not bound to any tenant" do
      admin.update!(organization_id: nil)

      login("admin@example.com", "password123")

      expect(response).to have_http_status(:unauthorized)
    end

    it "gives the same generic error whether the tenant or the password is wrong" do
      admin.update!(organization_id: other_org.id)
      login("admin@example.com", "password123")
      wrong_tenant = response.body
      login("admin@example.com", "nope")

      expect(response.body).to eq(wrong_tenant)
    end
  end
end
