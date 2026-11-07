# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  describe '#invite_url' do
    around do |example|
      original_url = Rails.configuration.x.web_base_url
      Rails.configuration.x.web_base_url = 'https://web.example.com'
      example.run
    ensure
      Rails.configuration.x.web_base_url = original_url
    end

    it 'uses the validated public web origin and candidate route' do
      session = described_class.new(invite_token: 'candidate-token')

      expect(session.invite_url).to eq(
        'https://web.example.com/interview/candidate-token'
      )
    end
  end

  describe '#claim_audio_connection!' do
    let(:organization) do
      Organization.create!(name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp', host: 'test.example.test')
    end
    let(:assessment) do
      Assessment.unscoped.create!(
        tenant_id: organization.id, created_by: 1, name: 'Reconnect', time_limit_min: 45, language: 'en'
      )
    end
    let(:session) { described_class.unscoped.create!(tenant_id: organization.id, assessment: assessment) }

    it 'hands the session to the newest connection' do
      session.claim_audio_connection!('first')
      session.claim_audio_connection!('second')

      expect(session.reload.active_connection_id).to eq('second')
    end

    it 'refuses a session that already ended, even from a stale record' do
      stale_copy = described_class.unscoped.find(session.id)
      session.update!(status: 'ended')

      expect(stale_copy.claim_audio_connection!('late')).to be(false)
      expect(session.reload.active_connection_id).to be_nil
    end
  end
end
