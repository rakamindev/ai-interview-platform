# frozen_string_literal: true

require 'rails_helper'

# W25: invite links pointed at the API (APP_BASE_URL), which has no /interview page.
RSpec.describe 'Candidate invite links (W25)' do
  let(:org) { create_org }
  let(:session) { create_interviewed_session(org: org, assessment: create_assessment(org: org)) }

  it 'points at the web app interview page, not the API' do
    allow(Rails.configuration.x).to receive(:web_app_url).and_return('https://interview.example.com')
    original = ENV['APP_BASE_URL']
    ENV['APP_BASE_URL'] = 'https://api.example.com'
    expect(session.invite_url).to eq("https://interview.example.com/interview/#{session.invite_token}")
  ensure
    ENV['APP_BASE_URL'] = original
  end

  describe WebAppUrl do
    let(:production) { ActiveSupport::StringInquirer.new('production') }
    let(:development) { ActiveSupport::StringInquirer.new('development') }

    it 'uses the local web app by default in development' do
      expect(described_class.resolve(nil, development)).to eq('http://localhost:5173')
    end

    it 'refuses to start production without a value' do
      expect { described_class.resolve('', production) }.to raise_error(ArgumentError, /WEB_APP_URL is not set/)
    end

    it 'refuses a placeholder or non-http value' do
      expect { described_class.resolve('https://<your-frontend-domain>', production) }
        .to raise_error(ArgumentError, /must be an http\(s\) URL/)
      expect { described_class.resolve('interview.example.com', production) }
        .to raise_error(ArgumentError, /must be an http\(s\) URL/)
    end

    it 'accepts an https URL and drops a trailing slash' do
      expect(described_class.resolve('https://interview.example.com/', production)).to eq('https://interview.example.com')
    end
  end
end
