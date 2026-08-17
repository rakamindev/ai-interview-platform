# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Sessions#transcript", type: :request do
  let(:org) { create_test_organization }
  let(:headers) { auth_headers_for(org) }
  let(:assessment) { Current.using(tenant_id: org.id) { create(:assessment) } }
  let(:session_record) { Current.using(tenant_id: org.id) { create(:session, assessment: assessment) } }

  it "flags transcript_capture_failed for the assessor when turn persistence failed" do
    session_record.update_column(:transcript_capture_failed_at, Time.current)

    get "/api/v1/sessions/#{session_record.id}/transcript", headers: headers

    body = JSON.parse(response.body)
    expect(body["transcript_capture_failed"]).to eq(true)
  end

  it "does not flag transcript_capture_failed for a normal session" do
    get "/api/v1/sessions/#{session_record.id}/transcript", headers: headers

    expect(JSON.parse(response.body)["transcript_capture_failed"]).to eq(false)
  end
end
