# frozen_string_literal: true

RSpec.describe 'Candidate invite routing', type: :request do
  let!(:organization) do
    Organization.create!(name: 'Synthetic Invite Org', scheme: 'invite-org',
                         identifier: 'invite-org', host: 'invite.example.test')
  end
  let!(:assessment) do
    Assessment.create!(tenant_id: organization.id, created_by: 1,
                       name: 'Synthetic interview', time_limit_min: 30)
  end
  let!(:user) do
    User.create!(email: 'invite-assessor@example.test', password: 'SyntheticPassword123!',
                 role: 'admin', organization: organization)
  end

  it 'returns a frontend invite that can retrieve candidate information' do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('WEB_BASE_URL').and_return('http://127.0.0.1:5173/')
    token = JsonWebToken.encode(user_id: user.id, role: 'admin', scheme: organization.scheme)

    post "/api/v1/assessments/#{assessment.id}/sessions",
         headers: { 'Authorization' => "Bearer #{token}" },
         params: { session: { candidate_name: 'Synthetic Candidate' } }

    expect(response).to have_http_status(:created)
    invite_url = JSON.parse(response.body).fetch('invite_url')
    expect(invite_url).to match(%r{\Ahttp://127\.0\.0\.1:5173/interview/[0-9a-f]{64}\z})

    invite_token = URI.parse(invite_url).path.split('/').last
    get "/api/v1/sessions/#{invite_token}/candidate"

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body).fetch('role_title')).to eq('Synthetic interview')
  end
end
