# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  describe 'consent' do
    let(:assessment) { create(:assessment) }
    let(:session) { create(:session, assessment: assessment) }

    it 'defaults to none' do
      expect(session.consent_status).to eq('none')
      expect(session.consent_given?).to be false
      expect(session.consent_revoked?).to be false
    end

    describe '#grant_consent!' do
      it 'marks consent as given with proof fields' do
        session.grant_consent!(version: 'v1', consent_text: 'notice text')

        expect(session.consent_given?).to be true
        expect(session.consent_version).to eq('v1')
        expect(session.consented_at).to be_present
        expect(session.consent_text_hash).to eq(Digest::SHA256.hexdigest('notice text'))
      end

      it 'refuses to grant consent on an ended session' do
        session.update!(status: 'ended', end_reason: 'manual_assessor')

        expect(session.grant_consent!).to be false
        expect(session.reload.consent_status).to eq('none')
      end
    end

    describe '#revoke_consent!' do
      it 'marks consent as revoked with timestamp' do
        session.grant_consent!(version: 'v1', consent_text: 'notice text')
        session.revoke_consent!

        expect(session.consent_revoked?).to be true
        expect(session.consent_revoked_at).to be_present
      end

      it 'refuses to revoke on an ended session' do
        session.update!(status: 'ended', end_reason: 'manual_assessor')

        expect(session.revoke_consent!).to be false
        expect(session.reload.consent_status).to eq('none')
      end
    end

    describe 'validation' do
      it 'requires consent_version when consent is given' do
        session.consent_status = 'given'
        session.consent_version = nil

        expect(session).not_to be_valid
        expect(session.errors[:consent_version]).to include("can't be blank")
      end

      it 'rejects invalid consent_status' do
        session.consent_status = 'maybe'

        expect(session).not_to be_valid
      end
    end
  end
end