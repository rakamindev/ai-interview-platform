require 'rails_helper'

RSpec.describe User, type: :model do
  describe 'validations' do
    context 'role' do
      it 'allows admin role' do
        user = User.new(
          email: 'admin@test.com',
          password: 'password123',
          role: 'admin'
        )
        expect(user).to be_valid
      end

      it 'allows user role' do
        user = User.new(
          email: 'user@test.com',
          password: 'password123',
          role: 'user'
        )
        expect(user).to be_valid
      end

      it 'disallows client role' do
        user = User.new(
          email: 'client@test.com',
          password: 'password123',
          role: 'client'
        )
        expect(user).not_to be_valid
        expect(user.errors[:role]).to include('is not included in the list')
      end
    end
  end
end
