# frozen_string_literal: true

require "rails_helper"

# assessment/gap-analysis.md P1-5: a deactivated admin kept full access to
# every tenant's candidate data until their token's 3-day expiry, with no way
# to cut that off sooner.
RSpec.describe "Account revocation", type: :request do
  let(:organization) { create(:organization) }

  it "allows a request from an active admin" do
    admin = create(:user, role: "admin", active: true)
    headers = auth_headers(organization: organization, role: "admin", user_id: admin.id)

    get "/api/v1/assessments", headers: headers

    expect(response).to have_http_status(:ok)
  end

  it "rejects a deactivated admin even with a correctly-signed, unexpired token" do
    admin = create(:user, role: "admin", active: false)
    headers = auth_headers(organization: organization, role: "admin", user_id: admin.id)

    get "/api/v1/assessments", headers: headers

    # ExceptionHandler::Unauthorized maps to 403, matching the existing
    # role-mismatch behavior in AuthorizeApiRequest#check_role! — the request
    # is authenticated (valid signature), just not permitted.
    expect(response).to have_http_status(:forbidden)
  end

  # 'assessor' tokens are minted by the sister rakamin-api app for accounts
  # that don't exist in this app's local users table at all — the active
  # check must not touch them (see AuthorizeApiRequest#account_active?).
  it "does not affect assessor-role tokens, whose accounts live outside this app's local users table" do
    headers = auth_headers(organization: organization, role: "assessor", user_id: 999_999)

    get "/api/v1/assessments", headers: headers

    expect(response).to have_http_status(:ok)
  end
end
