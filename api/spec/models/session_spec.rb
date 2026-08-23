# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  describe 'validations and callbacks' do
    let(:assessment) { create(:assessment) }
    subject { build(:session, assessment: assessment) }

    it 'is valid with valid attributes' do
      expect(subject).to be_valid
    end

    it 'auto-generates an invite_token before validation' do
      session = create(:session, assessment: assessment, invite_token: nil)
      expect(session.invite_token).to be_present
      expect(session.invite_token.length).to eq(64)
    end

    it 'validates status inclusion' do
      subject.status = 'invalid_status'
      expect(subject).not_to be_valid
    end
  end

  describe '#invite_url' do
    let(:assessment) { create(:assessment) }
    let(:session) { create(:session, assessment: assessment) }

    it 'resolves invite_url using FRONTEND_URL environment variable' do
      allow(ENV).to receive(:fetch).with('FRONTEND_URL').and_return('http://localhost:5173')
      expect(session.invite_url).to eq("http://localhost:5173/interview/#{session.invite_token}")
    end
  end
end
