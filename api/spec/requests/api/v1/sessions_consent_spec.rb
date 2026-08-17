# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Sessions#consent", type: :request do
  let(:org) { create_test_organization }
  let(:assessment) { Current.using(tenant_id: org.id) { create(:assessment) } }
  let(:session_record) { Current.using(tenant_id: org.id) { create(:session, assessment: assessment) } }

  it "records consent when the candidate accepts, no JWT required" do
    post "/api/v1/sessions/#{session_record.invite_token}/consent", params: { consent: { given: true } }

    expect(response).to have_http_status(:ok)
    expect(session_record.reload.consent_given?).to be true
    expect(session_record.consent.given_at).to be_present
    expect(session_record.consent.policy_version).to eq(Consent::CURRENT_POLICY_VERSION)
  end

  it "records a decline without treating it as consent" do
    post "/api/v1/sessions/#{session_record.invite_token}/consent", params: { consent: { given: false } }

    expect(response).to have_http_status(:ok)
    expect(session_record.reload.consent_given?).to be false
  end

  it "returns 404 for an unknown invite token" do
    post "/api/v1/sessions/does-not-exist/consent", params: { consent: { given: true } }

    expect(response).to have_http_status(:not_found)
  end

  it "is idempotent — re-consenting updates the same record instead of creating a duplicate" do
    post "/api/v1/sessions/#{session_record.invite_token}/consent", params: { consent: { given: true } }
    post "/api/v1/sessions/#{session_record.invite_token}/consent", params: { consent: { given: true } }

    expect(Consent.where(session_id: session_record.id).count).to eq(1)
  end

  it "reports consent_given in the candidate_info payload once given" do
    post "/api/v1/sessions/#{session_record.invite_token}/consent", params: { consent: { given: true } }

    get "/api/v1/sessions/#{session_record.invite_token}/candidate"

    expect(JSON.parse(response.body)["consent_given"]).to be true
  end

  it "defaults consent_given to false in candidate_info before any consent is recorded" do
    get "/api/v1/sessions/#{session_record.invite_token}/candidate"

    expect(JSON.parse(response.body)["consent_given"]).to be false
  end
end
