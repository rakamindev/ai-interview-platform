# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  describe '#invite_url' do
    let(:session) { create(:session, invite_token: 'abc123token') }

    it 'uses FRONTEND_BASE_URL env var when present' do
      stub_const('ENV', ENV.to_hash.merge('FRONTEND_BASE_URL' => 'https://interview.example.com'))
      expect(session.invite_url).to eq('https://interview.example.com/interview/abc123token')
    end

    it 'strips trailing slashes from base URL' do
      stub_const('ENV', ENV.to_hash.merge('FRONTEND_BASE_URL' => 'https://interview.example.com/'))
      expect(session.invite_url).to eq('https://interview.example.com/interview/abc123token')
    end

    it 'defaults to localhost:5173 when FRONTEND_BASE_URL is not set' do
      stub_const('ENV', ENV.to_hash.except('FRONTEND_BASE_URL'))
      expect(session.invite_url).to eq('http://localhost:5173/interview/abc123token')
    end
  end
end
