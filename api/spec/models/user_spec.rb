require 'rails_helper'

RSpec.describe User, type: :model do
  describe 'validations' do
    it 'is valid with valid attributes' do
      user = User.new(email: 'test@example.com', password: 'password123', role: 'admin')
      expect(user).to be_valid
    end

    it 'is not valid without an email' do
      user = User.new(password: 'password123', role: 'admin')
      expect(user).not_to be_valid
    end

    it 'is not valid with a duplicate email' do
      User.create!(email: 'test@example.com', password: 'password123', role: 'admin')
      user = User.new(email: 'test@example.com', password: 'password123', role: 'admin')
      expect(user).not_to be_valid
    end
  end

  describe '#generate_password_reset_token!' do
    it 'generates a reset token and sets sent_at' do
      user = User.create!(email: 'test@example.com', password: 'password123', role: 'admin')
      expect(user.reset_password_token).to be_nil
      
      expect {
        user.generate_password_reset_token!
      }.to change { ActionMailer::Base.deliveries.count }.by(1)
      
      expect(user.reset_password_token).not_to be_nil
      expect(user.reset_password_sent_at).not_to be_nil
    end
  end

  describe '#password_reset_valid?' do
    it 'is true if sent within 2 hours' do
      user = User.new(reset_password_sent_at: 1.hour.ago)
      expect(user.password_reset_valid?).to be true
    end

    it 'is false if sent more than 2 hours ago' do
      user = User.new(reset_password_sent_at: 3.hours.ago)
      expect(user.password_reset_valid?).to be false
    end
  end
end
