require 'rails_helper'

RSpec.describe Session, type: :model do
  describe '#invite_url' do
    # Regression coverage for assessment/03_defining_problem_and_gap_to_ideal_condition.md F1:
    # the invite link must open in the browser-facing SPA, never the Rails
    # API's own origin.
    around do |example|
      original_web = ENV['WEB_BASE_URL']
      original_app = ENV['APP_BASE_URL']
      example.run
      ENV['WEB_BASE_URL'] = original_web
      ENV['APP_BASE_URL'] = original_app
    end

    it 'builds the link against WEB_BASE_URL, not the API origin' do
      ENV['WEB_BASE_URL'] = 'https://interview.example.com'
      ENV['APP_BASE_URL'] = 'https://api.example.com'

      session = build(:session, invite_token: 'abc123')

      expect(session.invite_url).to eq('https://interview.example.com/interview/abc123')
    end

    it 'falls back to APP_BASE_URL only when WEB_BASE_URL is entirely unset, with a logged warning' do
      ENV.delete('WEB_BASE_URL')
      ENV['APP_BASE_URL'] = 'https://api.example.com'

      session = build(:session, invite_token: 'abc123')

      expect(Rails.logger).to receive(:warn).with(/WEB_BASE_URL is not set/)
      expect(session.invite_url).to eq('https://api.example.com/interview/abc123')
    end
  end
end
