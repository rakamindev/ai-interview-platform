# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::StartHandler do
  let(:organization) { create(:organization) }
  let(:assessment)   { create(:assessment, :with_skills, tenant_id: organization.id) }
  let(:session)      { create(:session, assessment: assessment, tenant_id: organization.id) }

  before do
    # Stub Redis publish so tests don't need a real Redis connection
    allow_any_instance_of(Redis).to receive(:publish)
    allow_any_instance_of(Redis).to receive(:close)
  end

  describe "#call" do
    it "transitions session status from pending to active" do
      expect { described_class.new(session).call }
        .to change { session.reload.status }.from("pending").to("active")
    end

    it "sets started_at" do
      described_class.new(session).call
      expect(session.reload.started_at).to be_within(2.seconds).of(Time.current)
    end

    it "creates coverage map entries for each assessment skill" do
      skill_count = assessment.assessment_skills.count
      described_class.new(session).call
      expect(session.coverage_maps.count).to eq(skill_count)
    end

    it "initializes coverage maps with state=not_yet and probe_count=0" do
      described_class.new(session).call
      session.coverage_maps.each do |map|
        expect(map.state).to eq("not_yet")
        expect(map.probe_count).to eq(0)
      end
    end

    it "is idempotent — does not double-create coverage maps on repeated calls" do
      described_class.new(session).call
      expect { described_class.new(session).call }
        .not_to change { session.coverage_maps.count }
    end

    it "returns the updated session" do
      result = described_class.new(session).call
      expect(result).to eq(session)
    end
  end
end
