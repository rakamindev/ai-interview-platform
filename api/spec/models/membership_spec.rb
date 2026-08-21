# frozen_string_literal: true

require "rails_helper"

RSpec.describe Membership, type: :model do
  describe "validations" do
    it "validates role inclusion" do
      membership = build(:membership, role: "admin")
      expect(membership).to be_valid

      membership.role = "invalid_role"
      expect(membership).not_to be_valid
      expect(membership.errors[:role]).to include("is not included in the list")
    end

    it "enforces unique user per organization" do
      existing = create(:membership)
      duplicate = build(:membership, user: existing.user, organization: existing.organization)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:user_id]).to include("already has a membership in this organization")
    end

    it "allows the same user in different organizations" do
      org1 = create(:organization)
      org2 = create(:organization)
      user = create(:user)
      create(:membership, user: user, organization: org1)
      membership2 = build(:membership, user: user, organization: org2)
      expect(membership2).to be_valid
    end
  end

  describe "associations" do
    it "belongs to a user" do
      membership = create(:membership)
      expect(membership.user).to be_a(User)
    end

    it "belongs to an organization" do
      membership = create(:membership)
      expect(membership.organization).to be_a(Organization)
    end
  end

  describe "ROLES" do
    it "includes admin, assessor, and user" do
      expect(described_class::ROLES).to contain_exactly("admin", "assessor", "user")
    end
  end
end
