# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Invite link redirect', type: :request do
  around do |example|
    previous = ENV['WEB_BASE_URL']
    ENV['WEB_BASE_URL'] = 'https://web.example.com'
    example.run
  ensure
    previous.nil? ? ENV.delete('WEB_BASE_URL') : ENV['WEB_BASE_URL'] = previous
  end

  it 'redirects old API-host invite links to the web app with a 302' do
    # Any token works — the redirect never validates it, only forwards it.
    token = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef'

    get "/interview/#{token}"

    expect(response).to have_http_status(:found)
    expect(response.location).to eq("https://web.example.com/interview/#{token}")
  end
end
