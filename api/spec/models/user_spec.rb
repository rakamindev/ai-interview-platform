# frozen_string_literal: true

require 'rails_helper'

RSpec.describe User, type: :model do
  describe 'validations' do
    it 'validates presence and format of email' do
      user = User.new(email: 'invalid_email_format', password: 'password123', role: 'user')
      expect(user).not_to be_valid
      expect(user.errors[:email]).to be_present
    end

    it 'validates inclusion of role in User::ROLES' do
      user = User.new(email: 'test@example.com', password: 'password123', role: 'unauthorized_role')
      expect(user).not_to be_valid
      expect(user.errors[:role]).to be_present

      user.role = 'user'
      user.valid?
      expect(user.errors[:role]).to be_empty

      user.role = 'admin'
      user.valid?
      expect(user.errors[:role]).to be_empty
    end
  end

  describe 'callbacks' do
    it 'downcases email before saving' do
      user = User.new(email: 'UPPERCASE.CANDIDATE@EXAMPLE.COM', password: 'password123', role: 'user')
      user.send(:downcase_email)
      expect(user.email).to eq('uppercase.candidate@example.com')
    end
  end

  describe 'password security' do
    it 'authenticates correct password and rejects incorrect password' do
      user = User.new(email: 'auth.test@example.com', password: 'correct_password', role: 'user')
      expect(user.authenticate('correct_password')).to be_truthy
      expect(user.authenticate('wrong_password')).to be_falsey
    end
  end
end
