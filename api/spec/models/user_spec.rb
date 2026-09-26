# frozen_string_literal: true

require 'rails_helper'

RSpec.describe User, type: :model do
  describe 'validations' do
    it 'is valid with valid attributes' do
      user = User.new(
        email: 'assessor@example.com',
        password: 'securepassword123',
        role: 'admin'
      )
      expect(user).to be_valid
    end

    it 'is invalid without an email' do
      user = User.new(password: 'password123', role: 'admin')
      expect(user).not_to be_valid
      expect(user.errors[:email]).to include("can't be blank")
    end

    it 'is invalid with an invalid email format' do
      user = User.new(email: 'invalid-email', password: 'password123', role: 'admin')
      expect(user).not_to be_valid
      expect(user.errors[:email]).to include('is invalid')
    end

    it 'is invalid with an invalid role' do
      user = User.new(email: 'user@example.com', password: 'password123', role: 'superadmin')
      expect(user).not_to be_valid
      expect(user.errors[:role]).to include('is not included in the list')
    end

    it 'is invalid with a password shorter than 6 characters' do
      user = User.new(email: 'short@example.com', password: '12345', role: 'admin')
      expect(user).not_to be_valid
      expect(user.errors[:password]).to include('is too short (minimum is 6 characters)')
    end

    it 'enforces case-insensitive uniqueness of email' do
      User.create!(email: 'recruiter@rakamin.com', password: 'password123', role: 'admin')
      duplicate = User.new(email: 'RECRUITER@RAKAMIN.COM', password: 'password456', role: 'admin')
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:email]).to include('has already been taken')
    end

    it 'downcases email before saving' do
      user = User.create!(email: 'MixedCase@Example.Com', password: 'password123', role: 'admin')
      expect(user.reload.email).to eq('mixedcase@example.com')
    end

    it 'authenticates correctly with matching password and rejects incorrect password' do
      user = User.create!(email: 'auth@example.com', password: 'secretpassword', role: 'admin')
      expect(user.authenticate('secretpassword')).to eq(user)
      expect(user.authenticate('wrongpassword')).to be(false)
    end
  end
end
