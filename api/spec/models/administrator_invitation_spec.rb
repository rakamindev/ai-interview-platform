# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AdministratorInvitation, type: :model do
  let(:organization) do
    Organization.create!(
      name: 'Tenant A', scheme: 'admin-invite-model',
      identifier: 'admin-invite-model', host: 'admin-invite-model.test.local'
    )
  end
  let(:inviter) do
    User.create!(email: 'inviter-model@test.corp', password: 'Password123!', role: 'admin', organization:)
  end

  def build_invitation(**attributes)
    described_class.new(
      {
        organization:, inviter:, recipient_email: ' Recipient@Example.COM ',
        token_digest: described_class.digest_token('raw-token'), expires_at: 1.hour.from_now
      }.merge(attributes)
    )
  end

  it 'normalizes recipient email and stores only a SHA-256 token digest' do
    invitation = build_invitation
    invitation.save!

    expect(invitation.recipient_email).to eq('recipient@example.com')
    expect(invitation.token_digest).to eq(Digest::SHA256.hexdigest('raw-token'))
    expect(invitation.attributes.values).not_to include('raw-token')
  end

  it 'requires a unique 64-character digest' do
    build_invitation.save!
    duplicate = build_invitation(recipient_email: 'other@example.com')

    expect(duplicate).not_to be_valid
    expect(duplicate.errors[:token_digest]).to include('has already been taken')
  end

  it 'derives active, expired, revoked, and accepted states from timestamps' do
    invitation = build_invitation
    invitation.save!
    expect(invitation.status).to eq('active')
    expect(invitation).to be_active

    invitation.update_column(:expires_at, 1.minute.ago)
    expect(invitation.reload.status).to eq('expired')

    invitation.update_columns(expires_at: 1.hour.from_now, revoked_at: Time.current)
    expect(invitation.reload.status).to eq('revoked')

    invitation.update_columns(revoked_at: nil, accepted_at: Time.current)
    expect(invitation.reload.status).to eq('accepted')
  end

  it 'rejects an invitation with both accepted and revoked timestamps' do
    invitation = build_invitation(accepted_at: Time.current, revoked_at: Time.current)

    expect(invitation).not_to be_valid
    expect(invitation.errors[:base]).to include('an invitation cannot be accepted and revoked')
  end
end
