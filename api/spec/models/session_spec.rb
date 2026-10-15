require 'rails_helper'

RSpec.describe Session, type: :model do
  describe '#invite_url' do
    it 'uses the frontend URL when APP_BASE_URL is not set' do
      original_value = ENV.delete('APP_BASE_URL')

      session = described_class.new(invite_token: 'test-token')

      expect(session.invite_url).to eq('http://localhost:5173/interview/test-token')
    ensure
      ENV['APP_BASE_URL'] = original_value if original_value
    end
  end
end