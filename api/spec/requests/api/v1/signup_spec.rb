# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Invitation-gated administrator signup', type: :request do
  let(:organization) do
    Organization.create!(name: 'Tenant A', scheme: 'signup-invite-a', identifier: 'signup-invite-a', host: 'signup-invite-a.test.local')
  end
  let(:other_organization) do
    Organization.create!(name: 'Tenant B', scheme: 'signup-invite-b', identifier: 'signup-invite-b', host: 'signup-invite-b.test.local')
  end
  let(:inviter) do
    User.create!(email: 'inviter@test.corp', password: 'Password123!', role: 'admin', organization:)
  end

  def issue(email: 'new-admin@example.com')
    AdministratorInvitations::Issuer.call(inviter:, email:)
  end

  def signup(token:, email: 'new-admin@example.com', password: 'Password123!', extra: {})
    post '/api/v1/auth/signup',
         params: { invitation_token: token, email:, password: }.merge(extra).to_json,
         headers: { 'Content-Type' => 'application/json' }
  end

  def validate(token)
    post '/api/v1/auth/admin_invitations/validate',
         params: { invitation_token: token }.to_json,
         headers: { 'Content-Type' => 'application/json' }
  end

  it 'rejects signup without an invitation and creates no user or JWT' do
    expect { signup(token: nil) }.not_to change(User, :count)

    expect(response).to have_http_status(:unprocessable_entity)
    body = JSON.parse(response.body)
    expect(body.dig('error', 'code')).to eq('invalid_invitation')
    expect(body['token']).to be_nil
  end

  it 'no longer exposes the public organization picker endpoint' do
    expect do
      Rails.application.routes.recognize_path('/api/v1/organizations', method: :get)
    end.to raise_error(ActionController::RoutingError)
  end

  it 'validates an active invitation without exposing token or digest' do
    invitation, raw_token = issue

    validate(raw_token)

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body.dig('invitation', 'recipient_email')).to eq('new-admin@example.com')
    expect(body.dig('invitation', 'organization', 'name')).to eq('Tenant A')
    expect(body.to_s).not_to include(raw_token)
    expect(body.to_s).not_to include(invitation.token_digest)
  end

  it 'creates one admin for the invitation tenant and issues its scheme in the JWT' do
    invitation, raw_token = issue

    expect { signup(token: raw_token) }.to change(User, :count).by(1)

    expect(response).to have_http_status(:created)
    body = JSON.parse(response.body)
    user = User.find_by!(email: 'new-admin@example.com')
    expect(user.role).to eq('admin')
    expect(user.tenant_id).to eq(organization.id)
    expect(invitation.reload.accepted_at).to be_present
    expect(JsonWebToken.decode_without_verification(body['token'])[:scheme]).to eq(organization.scheme)
  end

  it 'ignores client-supplied organization and role authority' do
    _invitation, raw_token = issue

    signup(token: raw_token, extra: { organization_id: other_organization.id, tenant_id: other_organization.id, role: 'user' })

    expect(response).to have_http_status(:created)
    user = User.find_by!(email: 'new-admin@example.com')
    expect(user.tenant_id).to eq(organization.id)
    expect(user.role).to eq('admin')
  end

  it 'rejects malformed, expired, revoked, accepted, and wrong-email invitations generically' do
    signup(token: 'malformed')
    expect(JSON.parse(response.body).dig('error', 'code')).to eq('invalid_invitation')

    expired, expired_token = issue(email: 'expired@example.com')
    expired.update_column(:expires_at, 1.minute.ago)
    signup(token: expired_token, email: 'expired@example.com')
    expect(JSON.parse(response.body).dig('error', 'code')).to eq('invalid_invitation')

    revoked, revoked_token = issue(email: 'revoked@example.com')
    revoked.update!(revoked_at: Time.current)
    signup(token: revoked_token, email: 'revoked@example.com')
    expect(JSON.parse(response.body).dig('error', 'code')).to eq('invalid_invitation')

    accepted, accepted_token = issue(email: 'accepted@example.com')
    accepted.update!(accepted_at: Time.current)
    signup(token: accepted_token, email: 'accepted@example.com')
    expect(JSON.parse(response.body).dig('error', 'code')).to eq('invalid_invitation')

    _wrong_email, wrong_email_token = issue(email: 'bound@example.com')
    signup(token: wrong_email_token, email: 'attacker@example.com')
    expect(JSON.parse(response.body).dig('error', 'code')).to eq('invalid_invitation')
  end

  it 'does not consume an invitation when a duplicate email prevents user creation' do
    existing = User.create!(email: 'duplicate@example.com', password: 'Password123!', role: 'admin', organization: other_organization)
    invitation, raw_token = issue(email: existing.email)

    expect { signup(token: raw_token, email: existing.email) }.not_to change(User, :count)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(invitation.reload.accepted_at).to be_nil
    expect(invitation).to be_active
  end

  it 'consumes an invitation exactly once' do
    invitation, raw_token = issue

    signup(token: raw_token)
    expect(response).to have_http_status(:created)

    expect { signup(token: raw_token) }.not_to change(User, :count)
    expect(response).to have_http_status(:unprocessable_entity)
    expect(invitation.reload.status).to eq('accepted')
  end

  it 'rejects a prospective candidate invitation token' do
    assessment = Assessment.create!(tenant_id: organization.id, created_by: inviter.id, name: 'Candidate assessment', time_limit_min: 30)
    candidate_session = Session.create!(tenant_id: organization.id, assessment:)

    signup(token: candidate_session.invite_token)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(User.find_by(email: 'new-admin@example.com')).to be_nil
  end
end
