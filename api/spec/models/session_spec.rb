# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  let(:org)        { create_organization }
  let(:assessment) { create_assessment(tenant: org) }
  let(:session)    { build_session(tenant: org, assessment: assessment) }

  describe '#consent_given?' do
    it 'is false when no consent record exists' do
      expect(session.consent_given?).to be false
    end

    it 'is false when consent is pending' do
      create_consent(session: session, status: 'pending')
      expect(session.consent_given?).to be false
    end

    it 'is false when consent is declined' do
      create_consent(session: session, status: 'declined')
      expect(session.consent_given?).to be false
    end

    it 'is true when consent is accepted' do
      create_consent(session: session, status: 'accepted')
      expect(session.consent_given?).to be true
    end
  end

  describe '#invite_url' do
    it 'uses WEB_BASE_URL so the link points at the web app, not the API' do
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with('WEB_BASE_URL', anything).and_return('http://web.example.test')
      expect(session.invite_url).to start_with('http://web.example.test/interview/')
    end
  end
end
