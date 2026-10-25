# frozen_string_literal: true

require 'rails_helper'

RSpec.describe OrganizationMembership, type: :model do
  describe 'validations' do
    it 'validates role inclusion in %w[admin assessor]' do
      membership = described_class.new(user_id: 1, organization_id: 1, role: 'invalid_role')
      expect(membership).not_to be_valid
      expect(membership.errors[:role]).to be_present

      described_class::ROLES.each do |role|
        membership.role = role
        membership.valid?
        expect(membership.errors[:role]).to be_empty
      end
    end

    it 'validates uniqueness of user_id scoped to organization_id' do
      user = User.create!(email: 'member.test@example.com', password: 'password123', role: 'user')
      org = Organization.create!(name: 'Test Org', scheme: 'test-scheme', identifier: 'test-scheme', host: 'localhost')

      described_class.create!(user: user, organization: org, role: 'admin')

      duplicate = described_class.new(user: user, organization: org, role: 'assessor')
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:user_id]).to include('is already a member of this organization')
    end
  end

  describe 'helper methods' do
    it 'reports correct boolean for admin? and assessor?' do
      admin_membership = described_class.new(role: 'admin')
      expect(admin_membership.admin?).to be true
      expect(admin_membership.assessor?).to be false

      assessor_membership = described_class.new(role: 'assessor')
      expect(assessor_membership.assessor?).to be true
      expect(assessor_membership.admin?).to be false
    end
  end

  describe 'User membership helpers' do
    it 'allows user to check role_in and member_of? across organizations' do
      user = User.create!(email: 'multi.tenant@example.com', password: 'password123', role: 'user')
      org_a = Organization.create!(name: 'Org A', scheme: 'org-a', identifier: 'org-a', host: 'localhost')
      org_b = Organization.create!(name: 'Org B', scheme: 'org-b', identifier: 'org-b', host: 'localhost')
      org_c = Organization.create!(name: 'Org C', scheme: 'org-c', identifier: 'org-c', host: 'localhost')

      described_class.create!(user: user, organization: org_a, role: 'admin')
      described_class.create!(user: user, organization: org_b, role: 'assessor')

      expect(user.member_of?(org_a)).to be true
      expect(user.member_of?(org_b)).to be true
      expect(user.member_of?(org_c)).to be false

      expect(user.role_in(org_a)).to eq('admin')
      expect(user.role_in(org_b)).to eq('assessor')
      expect(user.role_in(org_c)).to be_nil
    end
  end
end
