require "rails_helper"

RSpec.describe User, type: :model do
  describe "validations" do
    it "is valid with a well-formed factory" do
      expect(build(:user)).to be_valid
    end

    it "requires an email" do
      user = build(:user, email: nil)
      expect(user).not_to be_valid
      expect(user.errors[:email]).to be_present
    end

    it "rejects a malformed email" do
      user = build(:user, email: "not-an-email")
      expect(user).not_to be_valid
      expect(user.errors[:email]).to be_present
    end

    it "rejects a duplicate email regardless of case" do
      create(:user, email: "dup@example.com")
      user = build(:user, email: "DUP@example.com")

      expect(user).not_to be_valid
      expect(user.errors[:email]).to include("has already been taken")
    end

    it "only allows roles defined in User::ROLES" do
      user = build(:user, role: "superadmin")
      expect(user).not_to be_valid
      expect(user.errors[:role]).to be_present
    end

    it "accepts every role in User::ROLES" do
      User::ROLES.each do |role|
        expect(build(:user, role: role)).to be_valid
      end
    end
  end

  describe "email normalization" do
    it "downcases the email before saving, even if entered in mixed case" do
      user = create(:user, email: "MixedCase@Example.com")
      expect(user.reload.email).to eq("mixedcase@example.com")
    end
  end

  describe "password authentication (has_secure_password)" do
    it "authenticates with the correct password" do
      user = create(:user, password: "correct-horse")
      expect(user.authenticate("correct-horse")).to eq(user)
    end

    it "rejects an incorrect password" do
      user = create(:user, password: "correct-horse")
      expect(user.authenticate("wrong-password")).to be false
    end

    it "never stores the password in plaintext" do
      user = create(:user, password: "correct-horse")
      expect(user.password_digest).not_to eq("correct-horse")
      expect(user.password_digest).to start_with("$2a$")
    end

    it "generates a different salt (and digest) for two users with the identical password" do
      user_a = create(:user, password: "same-password")
      user_b = create(:user, password: "same-password")

      expect(user_a.password_digest).not_to eq(user_b.password_digest)
    end
  end
end
