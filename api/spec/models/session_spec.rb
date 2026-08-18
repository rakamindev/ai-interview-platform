# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session do
  let(:org) { create(:organization) }
  let(:assessment) { with_tenant(org) { create(:assessment) } }

  describe '#invite_url' do
    it 'points at the web application, not the API server' do
      with_env('WEB_APP_BASE_URL', 'http://localhost:5173') do
        session = with_tenant(org) { create(:session, assessment: assessment) }
        expect(session.invite_url).to start_with('http://localhost:5173/interview/')
        expect(session.invite_url).to include(session.invite_token)
      end
    end

    it 'falls back to a sane default when WEB_APP_BASE_URL is unset' do
      with_env('WEB_APP_BASE_URL', nil) do
        session = with_tenant(org) { create(:session, assessment: assessment) }
        expect(session.invite_url).to start_with('http://localhost:5173/interview/')
      end
    end
  end

  describe 'uuid-invite key' do
    it 'generates a unique token on create' do
      s1 = with_tenant(org) { create(:session, assessment: assessment) }
      s2 = with_tenant(org) { create(:session, assessment: assessment) }
      expect(s1.invite_token).not_to eq(s2.invite_token)
      expect(s1.invite_token.length).to eq(64)
    end
  end
end