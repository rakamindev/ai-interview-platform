# frozen_string_literal: true

require 'rails_helper'

RSpec.describe User, type: :model do
  describe 'validations and roles' do
    it 'is valid with valid attributes' do
      user = User.new(
        email: 'assessor@example.com',
        password: 'password123',
        role: 'assessor'
      )
      expect(user).to be_valid
    end

    it 'requires unique email' do
      User.create!(email: 'unique@example.com', password: 'password123', role: 'assessor')
      duplicate = User.new(email: 'unique@example.com', password: 'password123', role: 'assessor')
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:email]).to include('has already been taken')
    end

    it 'supports all system portal roles' do
      %w[admin assessor hiring_manager user].each do |r|
        user = User.new(
          email: "#{r}@example.com",
          password: 'password123',
          role: r
        )
        expect(user).to be_valid
        expect(user.role).to eq(r)
      end
    end
  end
end
