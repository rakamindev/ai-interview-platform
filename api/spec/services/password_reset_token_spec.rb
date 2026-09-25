# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PasswordResetToken do
  let!(:organization) do
    Organization.create!(
      name: 'Token Test Org', scheme: 'token-test-org', identifier: 'token-test-org',
      host: 'token-test-org.local', alias_hosts: [], config: {}
    )
  end
  let!(:user) do
    User.create!(
      email: 'reset@example.com', password: 'password123', password_confirmation: 'password123',
      role: 'admin', organization: organization
    )
  end

  it 'round-trips a signed purpose-bound reset token' do
    token = described_class.generate(user)
    expect(described_class.verify(token)).to eq(user)
  end

  it 'rejects a tampered token' do
    token = described_class.generate(user)
    expect(described_class.verify("#{token}tampered")).to be_nil
  end

  it 'rejects an expired token' do
    token = described_class.generate(user, expires_in: -1.second)
    expect(described_class.verify(token)).to be_nil
  end
end
