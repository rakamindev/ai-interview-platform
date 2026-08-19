# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  describe '#invite_url' do
    it 'uses the frontend base URL for candidate interview links' do
      session = described_class.new(invite_token: 'abc123')

      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with('FRONTEND_BASE_URL').and_return('http://localhost:5173')

      expect(session.invite_url).to eq('http://localhost:5173/interview/abc123')
    end
  end
end
