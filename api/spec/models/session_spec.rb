# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Session, type: :model do
  let(:organization) { create(:organization) }
  let(:assessment) { create(:assessment, tenant_id: organization.id) }

  before do
    Current.organization = organization
    Current.tenant_id = organization.id
  end

  describe 'Token generation & Status predicates (Positive)' do
    it 'automatically generates a 64-char hexadecimal invite token on create' do
      session = create(:session, assessment: assessment)
      expect(session.invite_token).to be_present
      expect(session.invite_token.length).to eq(64)
      expect(session.invite_token).to match(/\A[0-9a-f]{64}\z/)
    end

    it 'evaluates status predicates correctly' do
      pending_session = create(:session, assessment: assessment, status: 'pending')
      expect(pending_session.pending?).to be true
      expect(pending_session.active?).to be false
      expect(pending_session.ended?).to be false

      active_session = create(:session, :active, assessment: assessment)
      expect(active_session.active?).to be true
      expect(active_session.pending?).to be false

      ended_session = create(:session, :ended, assessment: assessment)
      expect(ended_session.ended?).to be true
      expect(ended_session.active?).to be false
    end

    it 'generates the invite url using default port 5173 when APP_BASE_URL is unset' do
      stub_const('ENV', ENV.to_hash.except('APP_BASE_URL'))
      session = create(:session, assessment: assessment)
      expect(session.invite_url).to eq("http://localhost:5173/interview/#{session.invite_token}")
    end
  end

  describe 'Validation constraints (Negative)' do
    it 'rejects invalid status assignment' do
      session = build(:session, assessment: assessment, status: 'unknown_status')
      expect(session).not_to be_valid
      expect(session.errors[:status]).to be_present
    end

    it 'rejects invalid end_reason assignment' do
      session = build(:session, assessment: assessment, end_reason: 'abrupt_disconnect_reason')
      expect(session).not_to be_valid
      expect(session.errors[:end_reason]).to be_present
    end

    it 'enforces uniqueness on invite_token' do
      existing = create(:session, assessment: assessment)
      duplicate = build(:session, assessment: assessment, invite_token: existing.invite_token)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:invite_token]).to be_present
    end
  end

  describe 'Edge cases for invite_url' do
    it 'strips trailing slashes from APP_BASE_URL environment variable' do
      stub_const('ENV', ENV.to_hash.merge('APP_BASE_URL' => 'https://ai-interview.example.com///'))
      session = create(:session, assessment: assessment)
      expect(session.invite_url).to eq("https://ai-interview.example.com/interview/#{session.invite_token}")
    end

    it 'handles APP_BASE_URL with custom port and path without trailing slash' do
      stub_const('ENV', ENV.to_hash.merge('APP_BASE_URL' => 'http://127.0.0.1:8080/portal'))
      session = create(:session, assessment: assessment)
      expect(session.invite_url).to eq("http://127.0.0.1:8080/portal/interview/#{session.invite_token}")
    end
  end

  describe 'Monkey / Fuzzing tests' do
    it 'accepts high-Unicode and emoji candidate names without crashing' do
      fuzz_names = [
        '🚀 丂ㄩ卩乇尺 匚卂几刀丨刀卂ㄒ乇 🚀',
        "O'Connor-Ñuñez & Sons",
        'أحمد بن علي 👨‍💻',
        '山田 太郎 (Yamada Tarō)',
        '<script>alert("xss")</script>',
        'A' * 255
      ]

      fuzz_names.each do |fuzz_name|
        session = create(:session, assessment: assessment, candidate_name: fuzz_name)
        expect(session.reload.candidate_name).to eq(fuzz_name)
      end
    end
  end
end
