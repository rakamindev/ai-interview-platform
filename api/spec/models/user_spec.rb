require 'rails_helper'

RSpec.describe User, type: :model do
  let(:valid_attributes) do
    {
      email: 'test@example.com',
      password: 'password123',
      role: 'user'
    }
  end

  describe 'Validations' do
    context 'Positive Cases' do
      it 'is valid with valid attributes' do
        user = User.new(valid_attributes)
        expect(user).to be_valid
      end

      it 'is valid with an admin role' do
        user = User.new(valid_attributes.merge(role: 'admin'))
        expect(user).to be_valid
      end
    end

    context 'Negative Cases' do
      it 'is invalid without an email' do
        user = User.new(valid_attributes.merge(email: nil))
        expect(user).not_to be_valid
        expect(user.errors[:email]).to include("can't be blank")
      end

      it 'is invalid with a badly formatted email' do
        user = User.new(valid_attributes.merge(email: 'invalid_email'))
        expect(user).not_to be_valid
        expect(user.errors[:email]).to include('is invalid')
      end

      it 'is invalid with a duplicate email' do
        User.create!(valid_attributes)
        user = User.new(valid_attributes.merge(password: 'different'))
        expect(user).not_to be_valid
        expect(user.errors[:email]).to include('has already been taken')
      end

      it 'is invalid without a password' do
        user = User.new(valid_attributes.merge(password: nil))
        expect(user).not_to be_valid
        expect(user.errors[:password]).to include("can't be blank")
      end

      it 'is invalid with an incorrect role' do
        user = User.new(valid_attributes.merge(role: 'superadmin'))
        expect(user).not_to be_valid
        expect(user.errors[:role]).to include('is not included in the list')
      end
    end
  end

  describe 'Callbacks' do
    it 'downcases email before saving' do
      user = User.new(valid_attributes.merge(email: 'UPPERCASE@EXAMPLE.COM'))
      user.save!
      expect(user.email).to eq('uppercase@example.com')
    end
  end
end
