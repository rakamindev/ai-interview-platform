# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session do
  describe '#invite_url' do
    subject(:url) { create(:session).invite_url }

    # /interview/:token is served by the web app. Built from the API's own base
    # URL, the link sent candidates to a Rails routing error.
    it 'points at the web app, not at this API' do
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with('WEB_APP_URL', anything).and_return('https://app.example.com')

      expect(url).to start_with('https://app.example.com/interview/')
    end

    it 'falls back to the local web app port' do
      expect(url).to start_with('http://localhost:5173/interview/')
    end

    it 'includes the invite token' do
      session = create(:session)

      expect(session.invite_url).to end_with("/interview/#{session.invite_token}")
    end
  end
end
