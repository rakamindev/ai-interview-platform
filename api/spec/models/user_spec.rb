# frozen_string_literal: true

require 'rails_helper'

RSpec.describe User, type: :model do
  # Test untuk validasi
  describe 'validations' do
    subject { build(:user) }

    it { should validate_presence_of(:email) }
    it { should validate_uniqueness_of(:email).case_insensitive }
    it { should allow_value('user@example.com').for(:email) }
    it { should_not allow_value('invalid_email').for(:email) }
    it { should validate_inclusion_of(:role).in_array(User::ROLES) }
  end

  # Test untuk callback
  describe 'callbacks' do
    it 'downcases email before saving' do
      user = create(:user, email: 'TEST@EXAMPLE.COM')
      expect(user.email).to eq('test@example.com')
    end
  end

  # Test untuk method has_secure_password
  describe 'password' do
    it { should have_secure_password }

    it 'authenticates with correct password' do
      user = create(:user, password: 'password123', password_confirmation: 'password123')
      expect(user.authenticate('password123')).to eq(user)
    end

    it 'does not authenticate with incorrect password' do
      user = create(:user, password: 'password123', password_confirmation: 'password123')
      expect(user.authenticate('wrongpassword')).to be false
    end
  end

  # Test untuk factory
  describe 'factory' do
    it 'has a valid factory' do
      expect(build(:user)).to be_valid
    end
  end
end