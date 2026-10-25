require 'rails_helper'

RSpec.describe User, type: :model do
  describe 'validations' do
    it 'valid with valid attributes' do
      user = build(:user)
      expect(user).to be_valid
    end

    it 'requires email' do
      user = build(:user, email: nil)
      expect(user).not_to be_valid
      expect(user.errors[:email]).to include("can't be blank")
    end

    it 'requires unique email' do
      create(:user, email: 'test@test-corp.com')
      user = build(:user, email: 'test@test-corp.com')
      expect(user).not_to be_valid
    end

    it 'requires valid role' do
      user = build(:user, role: 'superadmin')
      expect(user).not_to be_valid
      expect(user.errors[:role]).to include('is not included in the list')
    end

    it 'accepts hiring_manager role' do
      user = build(:user, :hiring_manager)
      expect(user).to be_valid
    end

    it 'accepts assessor role' do
      user = build(:user, :assessor)
      expect(user).to be_valid
    end

    it 'accepts recruiter role' do
      user = build(:user, :recruiter)
      expect(user).to be_valid
    end

    it 'rejects admin role' do
      user = build(:user, role: 'admin')
      expect(user).not_to be_valid
    end
  end
end
