# frozen_string_literal: true

require "rails_helper"

RSpec.describe Sessions::EndHandler, type: :service do
  before do
    allow(PortfolioGeneratorWorker).to receive(:perform_async)
    allow(::Redis).to receive(:new).and_return(double(publish: true, close: true))
  end

  describe "#call" do
    def run_handler(session, reason: "manual_assessor")
      described_class.new(session).call(reason: reason)
    end

    it "ends a pending session with ended status, end_reason, ended_at and computed duration" do
      ensure_tenant(TenantHelper::DEFAULT_TENANT_ID) do
        session = create(:session, started_at: 2.hours.ago)

        run_handler(session)

        session.reload
        expect(session.status).to eq("ended")
        expect(session.end_reason).to eq("manual_assessor")
        expect(session.ended_at).to be_present
        expect(session.duration_seconds).to eq(7200)
      end
    end

    it "defaults to manual_assessor when no reason is given" do
      ensure_tenant(TenantHelper::DEFAULT_TENANT_ID) do
        session = create(:session)

        described_class.new(session).call

        expect(session.reload.end_reason).to eq("manual_assessor")
      end
    end

    it "falls back to manual_assessor for an invalid reason" do
      ensure_tenant(TenantHelper::DEFAULT_TENANT_ID) do
        session = create(:session)

        run_handler(session, reason: "garbage")

        expect(session.reload.end_reason).to eq("manual_assessor")
      end
    end

    it "creates a pending portfolio for the session" do
      ensure_tenant(TenantHelper::DEFAULT_TENANT_ID) do
        session = create(:session)

        run_handler(session)

        portfolio = session.reload.portfolio
        expect(portfolio).to be_present
        expect(portfolio.generation_status).to eq("pending")
        expect(portfolio.candidate_id).to eq(session.candidate_id)
      end
    end

    it "does not duplicate a portfolio when one already exists" do
      ensure_tenant(TenantHelper::DEFAULT_TENANT_ID) do
        session = create(:session)
        portfolio = create(:portfolio, session: session, generation_status: "generating")

        run_handler(session)

        expect(Portfolio.where(session_id: session.id).count).to eq(1)
        expect(session.reload.portfolio).to eq(portfolio)
      end
    end

    it "is idempotent: a second call leaves end_reason alone and enqueues nothing new" do
      ensure_tenant(TenantHelper::DEFAULT_TENANT_ID) do
        session = create(:session, started_at: 2.hours.ago)

        run_handler(session)
        run_handler(session, reason: "all_covered")

        session.reload
        expect(session.status).to eq("ended")
        expect(session.end_reason).to eq("manual_assessor")
        expect(PortfolioGeneratorWorker).to have_received(:perform_async).with(session.id).exactly(:once)
      end
    end

    it "upgrades end_reason from error to a manual reason when already ended" do
      ensure_tenant(TenantHelper::DEFAULT_TENANT_ID) do
        session = create(:session, status: "ended", end_reason: "error", ended_at: Time.current)

        run_handler(session, reason: "manual_candidate")

        expect(session.reload.end_reason).to eq("manual_candidate")
      end
    end

    it "does nothing when already ended with a non-error reason" do
      ensure_tenant(TenantHelper::DEFAULT_TENANT_ID) do
        session = create(:session, status: "ended", end_reason: "all_covered", ended_at: Time.current)

        result = run_handler(session, reason: "manual_assessor")

        expect(result).to eq(session)
        expect(session.reload.end_reason).to eq("all_covered")
        expect(PortfolioGeneratorWorker).not_to have_received(:perform_async)
      end
    end

    it "swallows Redis publication failures" do
      ensure_tenant(TenantHelper::DEFAULT_TENANT_ID) do
        session = create(:session)
        allow(::Redis).to receive(:new).and_raise(StandardError, "connection refused")

        expect { run_handler(session) }.not_to raise_error
        expect(session.reload.status).to eq("ended")
      end
    end

    it "enqueues portfolio generation with the session id when a portfolio was just created" do
      ensure_tenant(TenantHelper::DEFAULT_TENANT_ID) do
        session = create(:session)

        run_handler(session)

        expect(PortfolioGeneratorWorker).to have_received(:perform_async).with(session.id)
      end
    end
  end
end