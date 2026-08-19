# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  describe '#invite_url' do
    it 'builds the interview link using the frontend (web) base URL' do
      session = build(:session, invite_token: 'abc123')

      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with('WEB_BASE_URL', anything).and_return('http://localhost:5173')

      expect(session.invite_url).to eq('http://localhost:5173/interview/abc123')
    end

    it 'does not point to the backend API port' do
      session = build(:session, invite_token: 'abc123')

      expect(session.invite_url).not_to include(':3001')
    end
  end
end
