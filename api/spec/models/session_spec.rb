# frozen_string_literal: true

require 'spec_helper'
require 'uri'

RSpec.describe Session, type: :model do
  let(:session) { described_class.new(invite_token: 'safe-public-token') }

  around do |example|
    previous_web_origin = ENV['WEB_APP_BASE_URL']
    ENV['WEB_APP_BASE_URL'] = 'https://interview.example.test/candidate/'
    example.run
  ensure
    ENV['WEB_APP_BASE_URL'] = previous_web_origin
  end

  it 'builds the invite on the configured web origin, not the API origin' do
    expect(session.invite_url).to eq('https://interview.example.test/candidate/interview/safe-public-token')
  end

  it 'normalizes a trailing slash for an existing session token' do
    expect(URI.parse(session.invite_url).path).to eq('/candidate/interview/safe-public-token')
  end
end
