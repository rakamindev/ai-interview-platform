# frozen_string_literal: true

require 'rails_helper'

RSpec.describe User, type: :model do
  describe 'validations' do
    it 'is valid with a unique email, a password, and a known role' do
      expect(build(:user)).to be_valid
    end

    it 'requires an email' do
      user = build(:user, email: nil)

      expect(user).not_to be_valid
      expect(user.errors[:email]).to be_present
    end

    it 'rejects a malformed email' do
      user = build(:user, email: 'not-an-email')

      expect(user).not_to be_valid
      expect(user.errors[:email]).to be_present
    end

    it 'rejects a duplicate email regardless of case' do
      create(:user, email: 'dup@example.com')
      user = build(:user, email: 'DUP@example.com')

      expect(user).not_to be_valid
      expect(user.errors[:email]).to include('has already been taken')
    end

    it 'rejects a role outside the allowed list' do
      user = build(:user, role: 'superadmin')

      expect(user).not_to be_valid
      expect(user.errors[:role]).to be_present
    end
  end

  describe 'password' do
    it 'authenticates with the correct password and rejects the wrong one' do
      user = create(:user, password: 'correct-password')

      expect(user.authenticate('correct-password')).to eq(user)
      expect(user.authenticate('wrong-password')).to be false
    end
  end

  describe 'email normalization' do
    it 'downcases the email before saving' do
      user = create(:user, email: 'Mixed.Case@Example.com')

      expect(user.reload.email).to eq('mixed.case@example.com')
    end
  end
end
