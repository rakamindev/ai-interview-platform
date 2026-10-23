# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::EndHandler do
  let!(:org) do
    Organization.find_by(scheme: 'test-corp') || Organization.create!(
      name: 'Test Corp',
      scheme: 'test-corp',
      identifier: 'test-corp-id',
      host: 'localhost'
    )
  end
  let!(:user) { User.create!(email: "assessor2@test.com", password_digest: BCrypt::Password.create("secret123"), role: "admin") }
  let!(:assessment) do
    a = Assessment.create!(name: "DevOps Engineer", tenant_id: org.id, created_by: user.id, time_limit_min: 45)
    a.assessment_skills.create!(
      skill_label: "Kubernetes",
      l1_anchor: "L1", l2_anchor: "L2", l3_anchor: "L3", l4_anchor: "L4", l5_anchor: "L5"
    )
    a
  end
  let!(:session) do
    Session.create!(
      assessment: assessment,
      tenant_id: org.id,
      started_at: 15.minutes.ago,
      status: 'active'
    )
  end

  before do
    allow(PortfolioGeneratorWorker).to receive(:perform_async)
    # Stub redis publish so Redis connection is not strictly required in isolated specs
    allow_any_instance_of(described_class).to receive(:publish_status_update)
  end

  describe "#call" do
    it "transitions session to ended with duration and enqueues portfolio generation exactly once" do
      handler = described_class.new(session)
      result = handler.call(reason: 'manual_assessor')

      expect(result.status).to eq('ended')
      expect(result.ended_at).to be_present
      expect(result.duration_seconds).to be >= 890
      expect(result.end_reason).to eq('manual_assessor')
      expect(session.portfolio).to be_present
      expect(session.portfolio.generation_status).to eq('pending')
      expect(PortfolioGeneratorWorker).to have_received(:perform_async).with(session.id).once

      # Second invocation should be completely idempotent
      handler.call(reason: 'manual_assessor')
      expect(PortfolioGeneratorWorker).to have_received(:perform_async).with(session.id).once
    end

    it "safely falls back to manual_assessor if an invalid reason is provided" do
      handler = described_class.new(session)
      result = handler.call(reason: 'unsupported_reason')

      expect(result.end_reason).to eq('manual_assessor')
    end
  end
end
