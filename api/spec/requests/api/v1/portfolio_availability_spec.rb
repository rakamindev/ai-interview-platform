# frozen_string_literal: true

require 'rails_helper'

# Portfolio availability for data-deleted sessions (AC-B3 UX):
# a session whose consent was revoked must NOT poll "generating" forever.
RSpec.describe 'Portfolio availability', type: :request do
  let(:organization) { create(:organization) }
  let(:assessment)   { create(:assessment, tenant_id: organization.id) }
  let(:session)      { create(:session, tenant_id: organization.id, assessment: assessment) }
  let(:token)        { JsonWebToken.encode(user_id: 1, role: 'admin', scheme: organization.scheme) }
  let(:headers)      do
    { 'Authorization' => "Bearer #{token}", 'X-Tenant-Scheme' => organization.scheme }
  end

  it 'returns unavailable (not generating) when consent was revoked and no portfolio exists' do
    create(:consent, session: session, tenant_id: organization.id, status: 'revoked', revoked_at: Time.current)

    get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['status']).to eq('unavailable')
  end

  it 'returns generating while the portfolio record does not exist yet' do
    create(:consent, session: session, tenant_id: organization.id, status: 'granted')

    get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

    expect(response).to have_http_status(:accepted)
    expect(JSON.parse(response.body)['status']).to eq('generating')
  end
end