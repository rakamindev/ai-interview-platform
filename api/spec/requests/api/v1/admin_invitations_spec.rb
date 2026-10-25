# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Administrator invitation management', type: :request do
  let(:organization) do
    Organization.create!(name: 'Tenant A', scheme: 'admin-invite-a', identifier: 'admin-invite-a', host: 'admin-invite-a.test.local')
  end
  let(:other_organization) do
    Organization.create!(name: 'Tenant B', scheme: 'admin-invite-b', identifier: 'admin-invite-b', host: 'admin-invite-b.test.local')
  end
  let(:admin) do
    User.create!(email: 'admin-a@test.corp', password: 'Password123!', role: 'admin', organization:)
  end
  let(:other_admin) do
    User.create!(email: 'admin-b@test.corp', password: 'Password123!', role: 'admin', organization: other_organization)
  end

  def headers_for(user, scheme: user.organization.scheme, role: user.role)
    token = JsonWebToken.encode(user_id: user.id, role:, scheme:)
    { 'Authorization' => "Bearer #{token}", 'Content-Type' => 'application/json' }
  end

  def issue_for(user, email: 'recipient@example.com')
    AdministratorInvitations::Issuer.call(inviter: user, email:).first
  end

  it 'creates an email- and tenant-bound invitation while returning the raw link once' do
    post '/api/v1/admin_invitations',
         params: { email: ' Recipient@Example.COM ', role: 'user', tenant_id: other_organization.id }.to_json,
         headers: headers_for(admin)

    expect(response).to have_http_status(:created)
    body = JSON.parse(response.body)
    invitation = AdministratorInvitation.find(body.dig('invitation', 'id'))
    raw_token = URI.decode_www_form(URI(body['signup_url']).query).to_h.fetch('invitation')

    expect(invitation.tenant_id).to eq(organization.id)
    expect(invitation.inviter_id).to eq(admin.id)
    expect(invitation.recipient_email).to eq('recipient@example.com')
    expect(invitation.token_digest).to eq(AdministratorInvitation.digest_token(raw_token))
    expect(invitation.token_digest).not_to eq(raw_token)
    expect(invitation.expires_at).to be_within(5.seconds).of(24.hours.from_now)
    expect(body.dig('invitation', 'status')).to eq('active')
    expect(body.to_s).not_to include(invitation.token_digest)
  end

  it 'lists only the persisted admin tenant and never returns token material' do
    own = issue_for(admin)
    other = issue_for(other_admin, email: 'other@example.com')

    get '/api/v1/admin_invitations', headers: headers_for(admin)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body['invitations'].pluck('id')).to eq([own.id])
    expect(body.to_s).not_to include(own.token_digest)
    expect(body.to_s).not_to include(other.token_digest)
    expect(body.to_s).not_to include('signup_url')
  end

  it 'revokes an active invitation and treats a repeated revoke as idempotent' do
    invitation = issue_for(admin)

    2.times do
      post "/api/v1/admin_invitations/#{invitation.id}/revoke", headers: headers_for(admin)
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body).dig('invitation', 'status')).to eq('revoked')
    end
  end

  it 'does not expose or revoke a cross-tenant invitation' do
    invitation = issue_for(other_admin)

    post "/api/v1/admin_invitations/#{invitation.id}/revoke", headers: headers_for(admin)

    expect(response).to have_http_status(:not_found)
    expect(invitation.reload.revoked_at).to be_nil
  end

  it 'rejects missing authentication and a stale JWT tenant mismatch' do
    get '/api/v1/admin_invitations'
    expect(response).to have_http_status(:unauthorized)

    get '/api/v1/admin_invitations', headers: headers_for(admin, scheme: other_organization.scheme)
    expect(response).to have_http_status(:forbidden)

    get '/api/v1/admin_invitations', headers: headers_for(admin, scheme: 'unknown-tenant-scheme')
    expect(response).to have_http_status(:forbidden)
  end
end
