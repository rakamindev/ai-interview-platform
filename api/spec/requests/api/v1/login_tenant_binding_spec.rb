# frozen_string_literal: true

require 'rails_helper'

# Every tenant check in this service reads the `scheme` claim out of the JWT.
# That makes login the one place where a tenant is decided, and the decision
# is only as trustworthy as its input.
#
# Before this change the input was the caller's own request header, so an
# assessor with entirely valid credentials could name any organisation they
# liked and be issued a correctly signed token scoped to it. Nothing further
# down the stack could tell that token apart from a legitimate one — the
# signature is real, the user is real, and the only false thing in it is the
# tenant. The isolation added for portfolios sat on top of that claim.
RSpec.describe 'POST /api/v1/auth/login tenant binding', type: :request do
  let(:password) { 'correct horse battery staple' }

  let!(:home)   { create(:organization, scheme: 'home-corp') }
  let!(:victim) { create(:organization, scheme: 'victim-corp') }

  let!(:user) do
    create(:user, email: 'assessor@home-corp.local', password: password, organization: home)
  end

  def login(headers = {})
    post '/api/v1/auth/login',
         params: { email: user.email, password: password },
         headers: headers.merge('Accept' => 'application/json')
  end

  def scheme_in_issued_token
    JsonWebToken.decode(json_body['token'])[:scheme]
  end

  it 'issues a token scoped to the organisation the user belongs to' do
    login

    expect(response).to have_http_status(:ok)
    expect(scheme_in_issued_token).to eq('home-corp')
  end

  it 'ignores a tenant named by the caller' do
    login('X-Tenant-Scheme' => victim.scheme)

    expect(response).to have_http_status(:ok)
    expect(scheme_in_issued_token).to eq('home-corp')
  end

  # The old resolver was `SELECT scheme FROM organizations LIMIT 1` — no
  # ORDER BY, and no reference to the user at all. Two assessors from different
  # organisations were handed the same tenant, whichever row Postgres returned
  # first. This is the same expectation as the first example, stated for a user
  # who is deliberately not in that row.
  it 'does not fall back to whichever organisation the table returns first' do
    other = create(:user, email: 'assessor@victim-corp.local',
                          password: password, organization: victim)

    post '/api/v1/auth/login',
         params: { email: other.email, password: password },
         headers: { 'Accept' => 'application/json' }

    expect(scheme_in_issued_token).to eq('victim-corp')
  end

  # A user row with no organisation cannot be given a tenant, and guessing one
  # is how this defect started. Refusing the login is the only honest answer.
  it 'refuses to sign in a user with no organisation' do
    orphan = create(:user, email: 'orphan@nowhere.local', password: password, organization: home)
    orphan.update_column(:tenant_id, 0)

    post '/api/v1/auth/login',
         params: { email: orphan.email, password: password },
         headers: { 'Accept' => 'application/json' }

    expect(response).to have_http_status(:unauthorized)
    expect(json_body['token']).to be_nil
  end
end
