# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Coverage::MapInjector, type: :service do
  let(:org) { create_organization }
  let(:user) { create_user(org) }
  let(:assessment) do
    Assessment.create!(
      tenant_id: org.id,
      name: "Fullstack Engineer Assessment",
      time_limit_min: 30,
      created_by: user.id
    )
  end
  let(:session) do
    Session.create!(
      tenant_id: org.id,
      assessment: assessment,
      status: 'active',
      started_at: 10.minutes.ago
    )
  end

  describe "#all_covered?" do
    it "returns false when configured skills are empty" do
      injector = described_class.new(session)
      expect(injector.all_covered?).to be(false)
    end

    it "returns false when some configured skills are not covered" do
      session.coverage_maps.create!(
        skill_id: "sk-1",
        skill_label: "Ruby",
        state: "covered",
        probe_count: 3,
        is_discovered: false
      )
      session.coverage_maps.create!(
        skill_id: "sk-2",
        skill_label: "React",
        state: "partial",
        probe_count: 2,
        is_discovered: false
      )

      injector = described_class.new(session)
      expect(injector.all_covered?).to be(false)
    end

    it "returns true when all configured skills are covered and no discovered skills exist" do
      session.coverage_maps.create!(
        skill_id: "sk-1",
        skill_label: "Ruby",
        state: "covered",
        probe_count: 3,
        is_discovered: false
      )
      session.coverage_maps.create!(
        skill_id: "sk-2",
        skill_label: "React",
        state: "covered",
        probe_count: 3,
        is_discovered: false
      )

      injector = described_class.new(session)
      expect(injector.all_covered?).to be(true)
    end

    it "CRITICAL FIX: returns true when all configured skills are covered, even if a discovered skill was initiated, avoiding trapping candidate" do
      session.coverage_maps.create!(
        skill_id: "sk-1",
        skill_label: "Ruby",
        state: "covered",
        probe_count: 3,
        is_discovered: false
      )
      # Discovered skill initiated early in session, but not probed again
      session.coverage_maps.create!(
        skill_id: nil,
        skill_label: "GraphQL",
        state: "initiated",
        probe_count: 1,
        is_discovered: true,
        updated_at: 5.minutes.ago
      )

      injector = described_class.new(session)
      expect(injector.all_covered?).to be(true)
    end
  end

  describe "#injection_text" do
    it "formats payload with valid pacing and remaining metrics" do
      session.coverage_maps.create!(
        skill_id: "sk-1",
        skill_label: "Ruby",
        state: "not_yet",
        probe_count: 0,
        is_discovered: false
      )

      injector = described_class.new(session)
      text = injector.injection_text

      expect(text).to include("[COVERAGE_MAP]")
      expect(text).to include("[/COVERAGE_MAP]")
      expect(text).to include('"skills_remaining":1')
      expect(text).to include('"priority_next":"sk-1"')
    end
  end
end
