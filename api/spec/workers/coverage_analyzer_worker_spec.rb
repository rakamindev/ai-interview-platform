# frozen_string_literal: true

require "rails_helper"

RSpec.describe CoverageAnalyzerWorker do
  let(:assessment) { create(:assessment, :with_skills, skills_count: 1) }
  let(:skill)      { assessment.assessment_skills.first }
  let(:session)    { create(:session, assessment:, status: "ended") }
  let!(:map) { create(:coverage_map, session:, skill_id: skill.skill_id, skill_label: skill.skill_label) }
  let(:analyzer) { instance_double(Coverage::Analyzer) }

  before do
    allow(Coverage::Analyzer).to receive(:new).and_return(analyzer)
    allow(analyzer).to receive(:call).and_return(
      skill_updates: [
        { coverage_map_id: map.id, skill_id: map.skill_id, skill_label: map.skill_label,
          new_state: "initiated", new_probe_count: 1, last_signal: "signal" }
      ],
      discovered_skills: []
    )
  end

  describe "session has already ended" do
    it "skips analysis by default" do
      described_class.new.perform(session.id, 1)

      expect(map.reload.probe_count).to eq(0)
      expect(analyzer).not_to have_received(:call)
    end

    it "runs analysis anyway when force: true, for backfilling from a saved transcript" do
      described_class.new.perform(session.id, 1, force: true)

      expect(map.reload).to have_attributes(state: "initiated", probe_count: 1)
    end
  end
end
