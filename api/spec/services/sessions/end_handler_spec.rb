# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Sessions::EndHandler do
  let(:organization) { create(:organization) }
  let(:assessment)   { create(:assessment, tenant_id: organization.id) }
  let(:session) do
    create(:session, assessment: assessment, tenant_id: organization.id,
                     status: "active", started_at: 10.minutes.ago)
  end

  before do
    allow_any_instance_of(Redis).to receive(:publish)
    allow_any_instance_of(Redis).to receive(:close)
    allow(PortfolioGeneratorWorker).to receive(:perform_async)
  end

  describe "#call" do
    it "transitions session status to ended" do
      expect { described_class.new(session).call(reason: "manual_candidate") }
        .to change { session.reload.status }.to("ended")
    end

    it "sets end_reason to the supplied reason" do
      described_class.new(session).call(reason: "manual_assessor")
      expect(session.reload.end_reason).to eq("manual_assessor")
    end

    it "sets ended_at" do
      described_class.new(session).call
      expect(session.reload.ended_at).to be_within(2.seconds).of(Time.current)
    end

    it "calculates duration_seconds from started_at" do
      described_class.new(session).call
      expect(session.reload.duration_seconds).to be_between(590, 610) # ~10 minutes
    end

    it "creates a portfolio record for the session" do
      expect { described_class.new(session).call }
        .to change { session.reload.portfolio }.from(nil)
    end

    it "sets portfolio generation_status to pending" do
      described_class.new(session).call
      expect(session.reload.portfolio.generation_status).to eq("pending")
    end

    it "enqueues PortfolioGeneratorWorker" do
      described_class.new(session).call
      expect(PortfolioGeneratorWorker).to have_received(:perform_async).with(session.id)
    end

    context "when session is already ended" do
      before { session.update!(status: "ended", end_reason: "error") }

      it "allows upgrading end_reason from error to manual" do
        described_class.new(session).call(reason: "manual_candidate")
        expect(session.reload.end_reason).to eq("manual_candidate")
      end

      it "does NOT re-create the portfolio on repeated calls" do
        session.create_portfolio!(candidate_id: nil, generation_status: "complete")
        expect { described_class.new(session).call }
          .not_to change { Portfolio.count }
      end
    end

    context "with an invalid end_reason" do
      it "falls back to manual_assessor" do
        described_class.new(session).call(reason: "invalid_reason")
        expect(session.reload.end_reason).to eq("manual_assessor")
      end
    end
  end
end
