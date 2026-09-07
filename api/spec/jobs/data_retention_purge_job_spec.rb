# frozen_string_literal: true

require 'rails_helper'

RSpec.describe DataRetentionPurgeJob, type: :job do
  let!(:organization) do
    Organization.create!(
      name: 'Rakamin Academy',
      scheme: 'rakamin',
      identifier: 'rakamin-main',
      host: 'rakamin.com',
      config: {}
    )
  end

  let!(:assessment) do
    Assessment.create!(
      tenant_id: organization.id,
      created_by: 1,
      name: 'Backend Engineer Assessment',
      time_limit_min: 30
    )
  end

  # Expired Session (Created 31 days ago)
  let!(:expired_session) do
    s = Session.create!(
      tenant_id: organization.id,
      assessment_id: assessment.id,
      candidate_name: 'Alice Expired',
      status: 'ended',
      end_reason: 'all_covered',
      consented_at: 31.days.ago,
      consent_version: 'v1.0',
      consent_ip_address: '203.0.113.195',
      consent_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64)',
      created_at: 31.days.ago
    )

    # Attach transcript turns (simulated biometric speech text)
    3.times do |i|
      s.transcript_turns.create!(
        turn_number: i + 1,
        speaker: i.even? ? 'ai' : 'candidate',
        text: "Verbatim speech turn #{i + 1} with sensitive candidate answers"
      )
    end

    # Attach Portfolio and Competency Score
    portfolio = s.create_portfolio!(generation_status: 'complete')
    portfolio.portfolio_skills.create!(
      skill_label: 'Ruby on Rails',
      ai_level: 4,
      ai_confidence: 'high',
      evidence: ['Demonstrated deep understanding of ActiveRecord and Sidekiq'],
      competency_summary: 'Senior level capability'
    )

    s
  end

  # Active Session (Created 5 days ago)
  let!(:active_session) do
    s = Session.create!(
      tenant_id: organization.id,
      assessment_id: assessment.id,
      candidate_name: 'Bob Active',
      status: 'ended',
      end_reason: 'all_covered',
      consented_at: 5.days.ago,
      consent_version: 'v1.0',
      consent_ip_address: '198.51.100.42',
      consent_user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
      created_at: 5.days.ago
    )

    # Attach transcript turns
    2.times do |i|
      s.transcript_turns.create!(
        turn_number: i + 1,
        speaker: i.even? ? 'ai' : 'candidate',
        text: "Active session transcript turn #{i + 1}"
      )
    end

    portfolio = s.create_portfolio!(generation_status: 'complete')
    portfolio.portfolio_skills.create!(
      skill_label: 'PostgreSQL',
      ai_level: 3,
      ai_confidence: 'medium',
      evidence: ['Understands relational modeling'],
      competency_summary: 'Mid level capability'
    )

    s
  end

  describe '#perform' do
    it 'purges transcripts and anonymizes PII for sessions past 30 days while preserving active data' do
      expect(expired_session.transcript_turns.count).to eq(3)
      expect(active_session.transcript_turns.count).to eq(2)

      # Execute automated retention lifecycle job
      described_class.perform_now(nil, days: 30)

      # ── Assert Expired Session State ─────────────────────────────────────────
      expired_session.reload
      expect(expired_session.transcript_turns.count).to eq(0)
      expect(expired_session.candidate_name).to eq('Anonymized Candidate')
      expect(expired_session.consent_ip_address).to be_nil
      expect(expired_session.consent_user_agent).to be_nil
      expect(expired_session.anonymized_at).to be_within(5.seconds).of(Time.current)
      expect(expired_session.data_purged_at).to be_present
      expect(expired_session.anonymized?).to be true

      # Verify high-level competency scores are preserved for hiring analytics
      expect(expired_session.portfolio).to be_present
      expect(expired_session.portfolio.portfolio_skills.count).to eq(1)
      expect(expired_session.portfolio.portfolio_skills.first.ai_level).to eq(4)

      # ── Assert Active Session State ──────────────────────────────────────────
      active_session.reload
      expect(active_session.transcript_turns.count).to eq(2)
      expect(active_session.candidate_name).to eq('Bob Active')
      expect(active_session.consent_ip_address).to eq('198.51.100.42')
      expect(active_session.anonymized_at).to be_nil
      expect(active_session.anonymized?).to be false
    end
  end
end
