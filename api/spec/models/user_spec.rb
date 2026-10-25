# frozen_string_literal: true

require 'rails_helper'

# UI enhancement (Pilar 4) — password policy as a two-sided contract.
# The backend is the source of truth: passwords must be 8–72 characters.
# The signup form mirrors these exact rules and messages.
RSpec.describe User, type: :model do
  let(:org) do
    Organization.create!(
      name: 'Alpha Corp',
      scheme: 'alpha-test',
      identifier: 'alpha-test',
      host: 'alpha.test.local'
    )
  end

  def build_user(attrs = {})
    User.new(
      { email: 'assessor@test.corp', password: 'Password123!', role: 'admin', organization: org }.merge(attrs)
    )
  end

  describe 'password policy' do
    it 'accepts a password of exactly 8 characters' do
      user = build_user(password: '12345678')
      expect(user).to be_valid
    end

    it 'accepts a password of exactly 72 characters' do
      user = build_user(password: 'a' * 72)
      expect(user).to be_valid
    end

    it 'rejects a password shorter than 8 characters' do
      user = build_user(password: '1234567')
      expect(user).not_to be_valid
      expect(user.errors[:password]).to include('must be between 8 and 72 characters')
    end

    it 'rejects a password longer than 72 characters' do
      user = build_user(password: 'a' * 73)
      expect(user).not_to be_valid
      expect(user.errors[:password]).to include('must be between 8 and 72 characters')
    end

    it 'allows nil password on updates that do not change the password (existing users stay valid)' do
      user = build_user
      user.save!(validate: false) # simulate a pre-policy account
      user.email = 'updated@test.corp'
      expect(user).to be_valid
      expect(user.errors[:password]).to be_empty
    end
  end
end