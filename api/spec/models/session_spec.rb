# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  describe '#invite_url' do
    around do |example|
      previous = ENV['WEB_BASE_URL']
      example.run
    ensure
      previous.nil? ? ENV.delete('WEB_BASE_URL') : ENV['WEB_BASE_URL'] = previous
    end

    it 'builds the invite link from WEB_BASE_URL and appends the invite token' do
      ENV['WEB_BASE_URL'] = 'https://web.example.com'
      session = Session.new(invite_token: 'abc123', tenant_id: 1)

      expect(session.invite_url).to eq('https://web.example.com/interview/abc123')
    end

    it 'falls back to the local web origin when WEB_BASE_URL is unset' do
      ENV.delete('WEB_BASE_URL')
      session = Session.new(invite_token: 'abc123', tenant_id: 1)

      expect(session.invite_url).to eq('http://localhost:5173/interview/abc123')
    end
  end
end
