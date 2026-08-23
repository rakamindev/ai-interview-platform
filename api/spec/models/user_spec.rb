# frozen_string_literal: true

require 'rails_helper'

RSpec.describe User, type: :model do
  describe 'validations' do
    it { is_expected.to validate_presence_of(:email) }

    it 'validates email uniqueness' do
      create(:user, email: 'test@example.com')
      duplicate = build(:user, email: 'test@example.com')
      duplicate.validate
      expect(duplicate.errors[:email]).to include('has already been taken')
    end

    it { is_expected.to validate_inclusion_of(:role).in_array(%w[admin user]) }
  end

  describe 'password' do
    it 'requires password on create' do
      user = build(:user, password: nil)
      expect(user).not_to be_valid
      expect(user.errors[:password]).to include("can't be blank")
    end

    it 'requires password confirmation to match' do
      user = build(:user, password: 'password123', password_confirmation: 'different')
      expect(user).not_to be_valid
    end
  end

  describe 'callbacks' do
    it 'downcases email before save' do
      user = create(:user, email: 'USER@EXAMPLE.COM')
      expect(user.email).to eq('user@example.com')
    end
  end

  describe 'constants' do
    it 'defines ROLES' do
      expect(User::ROLES).to eq(%w[admin user])
    end
  end
end
