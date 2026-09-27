# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  let(:org) { create(:organization) }
  let(:assessment) { create(:assessment, tenant_id: org.id) }

  it 'generates a 64-character hex invite token automatically on creation' do
    session = create(:session, assessment: assessment, tenant_id: org.id)
    expect(session.invite_token).to be_present
    expect(session.invite_token.length).to eq(64)
  end

  it 'defaults status to pending' do
    session = create(:session, assessment: assessment, tenant_id: org.id)
    expect(session.status).to eq('pending')
    expect(session.pending?).to be true
  end

  describe '#invite_url' do
    it 'resolves invite_url pointing to WEB_BASE_URL on port 5173 by default' do
      session = create(:session, assessment: assessment, tenant_id: org.id)
      expect(session.invite_url).to eq("http://localhost:5173/interview/#{session.invite_token}")
    end

    it 'respects custom WEB_BASE_URL environment variable' do
      stub_const('ENV', ENV.to_hash.merge('WEB_BASE_URL' => 'https://app.example.com'))
      session = create(:session, assessment: assessment, tenant_id: org.id)
      expect(session.invite_url).to eq("https://app.example.com/interview/#{session.invite_token}")
    end
  end
end
