# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session do
  describe '#invite_url' do
    let(:session) { build_session(status: 'pending') }

    around do |example|
      saved = ENV.to_h.slice('FRONTEND_URL', 'ALLOWED_ORIGINS')
      ENV.delete('FRONTEND_URL')
      ENV.delete('ALLOWED_ORIGINS')
      example.run
    ensure
      %w[FRONTEND_URL ALLOWED_ORIGINS].each { |k| saved.key?(k) ? ENV[k] = saved[k] : ENV.delete(k) }
    end

    it 'prefers FRONTEND_URL and strips a trailing slash' do
      ENV['FRONTEND_URL'] = 'https://interview.example.com/'

      expect(session.invite_url).to eq("https://interview.example.com/interview/#{session.invite_token}")
    end

    it 'falls back to the first http(s) CORS origin' do
      ENV['ALLOWED_ORIGINS'] = ' https://app.example.com , https://other.example.com'

      expect(session.invite_url).to start_with('https://app.example.com/interview/')
    end

    it 'ignores a wildcard CORS origin and uses the local web app' do
      ENV['ALLOWED_ORIGINS'] = '*'

      expect(session.invite_url).to start_with('http://localhost:5173/interview/')
    end

    it 'never points candidates at the API port' do
      expect(session.invite_url).not_to include(':3001')
    end
  end
end
