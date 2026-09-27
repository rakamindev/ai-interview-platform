# frozen_string_literal: true

require 'rails_helper'

RSpec.describe User, type: :model do
  describe 'constants' do
    it 'defines ROLES including admin, assessor, and user' do
      expect(User::ROLES).to match_array(%w[admin assessor user])
    end
  end

  describe 'associations' do
    it 'belongs to organization optionally' do
      org = create(:organization)
      user_with_org = create(:user, organization: org)
      user_without_org = create(:user, organization: nil)

      expect(user_with_org.organization).to eq(org)
      expect(user_without_org.organization).to be_nil
    end
  end

  describe 'validations' do
    it 'accepts assessor role' do
      user = build(:user, role: 'assessor')
      expect(user).to be_valid
    end

    it 'accepts admin role' do
      user = build(:user, role: 'admin')
      expect(user).to be_valid
    end

    it 'accepts user role' do
      user = build(:user, role: 'user')
      expect(user).to be_valid
    end

    it 'rejects invalid roles' do
      user = build(:user, role: 'invalid_role')
      expect(user).not_to be_valid
      expect(user.errors[:role]).to be_present
    end

    it 'downcases email before saving' do
      user = create(:user, email: 'TEST.USER@EXAMPLE.COM')
      expect(user.reload.email).to eq('test.user@example.com')
    end
  end
end
