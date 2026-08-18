# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  describe '#invite_url' do
    it 'generates a candidate-facing interview URL using WEB_BASE_URL' do
      session = described_class.new(invite_token: 'test-invite-token')

      allow(ENV).to receive(:fetch)
        .with('WEB_BASE_URL', anything)
        .and_return('http://localhost:5173')

      expect(session.invite_url)
        .to eq('http://localhost:5173/interview/test-invite-token')
    end
  end
end
