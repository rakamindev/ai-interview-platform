# frozen_string_literal: true

RSpec.describe 'Assessor tenant authentication', type: :request do
  let!(:owner) do
    Organization.create!(name: 'Synthetic Owner', scheme: 'login-owner',
                         identifier: 'login-owner', host: 'login-owner.example.test')
  end
  let!(:other) do
    Organization.create!(name: 'Synthetic Other', scheme: 'login-other',
                         identifier: 'login-other', host: 'login-other.example.test')
  end
  let!(:user) do
    User.create!(email: 'assessor@example.test', password: 'SyntheticPassword123!',
                 role: 'admin', organization: owner)
  end

  def login(headers = {})
    post '/api/v1/auth/login', headers: headers,
         params: { email: user.email, password: 'SyntheticPassword123!' }
  end

  it 'issues a token for the user tenant even when a client selects another tenant' do
    login('X-Tenant-Scheme' => other.scheme)

    expect(response).to have_http_status(:ok)
    token = JSON.parse(response.body).fetch('token')
    expect(JsonWebToken.decode(token)[:scheme]).to eq(owner.scheme)
  end

  it 'issues the user tenant without a tenant header' do
    login

    expect(response).to have_http_status(:ok)
    token = JSON.parse(response.body).fetch('token')
    expect(JsonWebToken.decode(token)[:scheme]).to eq(owner.scheme)
  end

  it 'rejects an account without an assigned tenant' do
    user.update_column(:tenant_id, nil)
    login('X-Tenant-Scheme' => other.scheme)

    expect(response).to have_http_status(:unauthorized)
  end

  it 'rejects an unknown tenant instead of resolving the default organization' do
    get '/api/v1/assessments', headers: { 'X-Tenant-Scheme' => 'unknown.example.test' }

    expect(response).to have_http_status(:forbidden)
  end

  it 'rejects an older signed token whose tenant claim differs from the account tenant' do
    token = JsonWebToken.encode(user_id: user.id, role: user.role, scheme: other.scheme)

    get '/api/v1/assessments', headers: { 'Authorization' => "Bearer #{token}" }

    expect(response).to have_http_status(:unauthorized)
  end

  it 'rejects a previously valid token after the account is moved to another tenant' do
    token = JsonWebToken.encode(user_id: user.id, role: user.role, scheme: owner.scheme)
    user.update!(organization: other)

    get '/api/v1/assessments', headers: { 'Authorization' => "Bearer #{token}" }

    expect(response).to have_http_status(:unauthorized)
  end
end
