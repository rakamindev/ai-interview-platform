# frozen_string_literal: true

require "rails_helper"

RSpec.describe CoverageAnalyzerWorker do
  let(:assessment)  { create(:assessment) }
  let(:session)     { create(:session, assessment: assessment, status: "active") }

  before do
    # Create skill taxonomy and assessment skill for prompt building
    create(:assessment_skill, assessment: assessment)
  end

  describe "#perform" do
    context "when session is active" do
      it "delegates to Coverage::Analyzer" do
        analyzer = instance_double(Coverage::Analyzer)
        allow(Coverage::Analyzer).to receive(:new).and_return(analyzer)
        allow(analyzer).to receive(:call).and_return({ skill_updates: [], discovered_skills: [] })

        described_class.new.perform(session.id, 1)

        expect(Coverage::Analyzer).to have_received(:new).with(session: session)
      end

      it "applies skill updates returned by the analyzer" do
        map = create(:coverage_map, session: session, state: "initiated", probe_count: 1)
        analyzer = instance_double(Coverage::Analyzer)
        allow(Coverage::Analyzer).to receive(:new).and_return(analyzer)
        allow(analyzer).to receive(:call).and_return({
          skill_updates: [{ coverage_map_id: map.id, new_state: "partial", new_probe_count: 2, last_signal: "discussed" }],
          discovered_skills: []
        })

        described_class.new.perform(session.id, 1)

        map.reload
        expect(map.state).to eq("partial")
        expect(map.probe_count).to eq(2)
        expect(map.last_signal).to eq("discussed")
      end

      it "creates discovered skills" do
        analyzer = instance_double(Coverage::Analyzer)
        allow(Coverage::Analyzer).to receive(:new).and_return(analyzer)
        allow(analyzer).to receive(:call).and_return({
          skill_updates: [],
          discovered_skills: [{ label: "Docker", first_mention: "Candidate mentioned Docker" }]
        })

        expect do
          described_class.new.perform(session.id, 1)
        end.to change { session.coverage_maps.discovered.count }.by(1)

        discovered = session.coverage_maps.discovered.last
        expect(discovered.skill_label).to eq("Docker")
        expect(discovered.state).to eq("initiated")
      end

      it "auto-advance stale partial skills with probe_count >= 4" do
        stale = create(:coverage_map, session: session, state: "partial", probe_count: 5)
        analyzer = instance_double(Coverage::Analyzer)
        allow(Coverage::Analyzer).to receive(:new).and_return(analyzer)
        allow(analyzer).to receive(:call).and_return({ skill_updates: [], discovered_skills: [] })

        described_class.new.perform(session.id, 1)

        stale.reload
        expect(stale.state).to eq("covered")
      end

      it "does not auto-advance skills updated in the same run" do
        map = create(:coverage_map, session: session, state: "partial", probe_count: 5)
        analyzer = instance_double(Coverage::Analyzer)
        allow(Coverage::Analyzer).to receive(:new).and_return(analyzer)
        allow(analyzer).to receive(:call).and_return({
          skill_updates: [{ coverage_map_id: map.id, new_state: "partial", new_probe_count: 6, last_signal: "still discussing" }],
          discovered_skills: []
        })

        described_class.new.perform(session.id, 1)

        map.reload
        expect(map.state).to eq("partial")
      end
    end

    context "when session has ended" do
      it "skips analysis" do
        session.update!(status: "ended")
        analyzer = instance_double(Coverage::Analyzer)
        allow(Coverage::Analyzer).to receive(:new).and_return(analyzer)
        allow(analyzer).to receive(:call)

        described_class.new.perform(session.id, 1)

        expect(analyzer).not_to have_received(:call)
      end
    end

    context "when session not found" do
      it "logs and returns" do
        expect(Rails.logger).to receive(:warn).with(/not found/)

        described_class.new.perform(-1, 1)
      end
    end

    context "when analyzer raises" do
      it "logs the error and does not re-raise" do
        allow_any_instance_of(Coverage::Analyzer).to receive(:call).and_raise(StandardError, "boom")
        expect(Rails.logger).to receive(:error).with(/Coverage analyzer failed/)

        expect { described_class.new.perform(session.id, 1) }.not_to raise_error
      end
    end
  end

  describe "sidekiq configuration" do
    it "uses the coverage queue" do
      expect(described_class.sidekiq_options["queue"]).to eq(:coverage)
    end

    it "does not retry" do
      expect(described_class.sidekiq_options["retry"]).to eq(0)
    end
  end
end
