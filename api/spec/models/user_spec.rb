# frozen_string_literal: true

require 'rails_helper'

RSpec.describe User, type: :model do
  describe 'validations' do
    it 'rejects a blank email' do
      user = build(:user, email: '')

      expect(user).not_to be_valid
      expect(user.errors[:email]).to include("can't be blank")
    end

    it 'rejects a malformed email' do
      user = build(:user, email: 'not-an-email')

      expect(user).not_to be_valid
      expect(user.errors[:email]).to include('is invalid')
    end

    it 'rejects a duplicate email regardless of case' do
      create(:user, email: 'assessor1@test.com')

      user = build(:user, email: 'ASSESSOR1@test.com')

      expect(user).not_to be_valid
      expect(user.errors[:email]).to include('has already been taken')
    end

    it 'accepts only the admin and user roles' do
      expect(build(:user, role: 'admin')).to be_valid
      expect(build(:user, role: 'user')).to be_valid
      expect(build(:user, role: 'superadmin')).not_to be_valid
    end

    it 'rejects a password shorter than 8 characters' do
      user = build(:user, password: 'short')

      expect(user).not_to be_valid
      expect(user.errors[:password]).to include('is too short (minimum is 8 characters)')
    end

    it 'does not require a password when saving without changing it' do
      user = create(:user)

      expect { user.update!(role: 'user') }.not_to raise_error
      expect(user.reload.role).to eq('user')
    end
  end

  describe '#authenticate' do
    it 'returns truthy for the correct password and falsy otherwise' do
      user = create(:user, password: 'password123')

      expect(user.authenticate('password123')).to be_truthy
      expect(user.authenticate('wrong-password')).to be_falsey
    end
  end
end
