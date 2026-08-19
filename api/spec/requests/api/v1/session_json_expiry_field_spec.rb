require 'rails_helper'

RSpec.describe 'Session JSON includes invite_expires_at', type: :request do
  let(:organization) { create(:organization) }
  let(:assessment)    { create(:assessment, tenant_id: organization.id) }
  let(:headers)        { assessor_auth_headers(organization) }

  it 'exposes invite_expires_at when listing sessions for an assessment' do
    session = create(:session, tenant_id: organization.id, assessment: assessment)

    get "/api/v1/assessments/#{assessment.id}/sessions", headers: headers

    body = JSON.parse(response.body)
    returned = body['sessions'].first
    expect(returned['invite_expires_at']).to be_present
    expect(Time.zone.parse(returned['invite_expires_at'])).to be_within(1.second).of(session.invite_expires_at)
  end
end
