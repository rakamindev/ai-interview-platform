# frozen_string_literal: true

require 'rails_helper'

# N9: ending a session closes it once, creates the portfolio once, and queues one
# generation job, whichever of the five end paths fires first.
RSpec.describe Sessions::EndHandler do
  let(:session) { create(:session, status: 'active', started_at: 6.minutes.ago) }

  def end_session(reason) = described_class.new(session).call(reason:)

  it 'closes the session with the reason, end time and duration' do
    freeze_time do
      end_session('manual_candidate')

      expect(session.reload).to have_attributes(
        status: 'ended', end_reason: 'manual_candidate', ended_at: Time.current, duration_seconds: 360
      )
    end
  end

  it 'creates a pending portfolio and queues exactly one generation job' do
    end_session('time_ceiling')

    expect(session.reload.portfolio).to have_attributes(generation_status: 'pending')
    expect(PortfolioGeneratorWorker.jobs.map { _1['args'] }).to eq([[session.id]])
  end

  it 'does nothing the second time: no new reason, portfolio or job' do
    end_session('all_covered')
    portfolio_id = session.reload.portfolio.id

    end_session('time_ceiling')

    expect(session.reload.end_reason).to eq('all_covered')
    expect(session.portfolio.id).to eq(portfolio_id)
    expect(PortfolioGeneratorWorker.jobs.size).to eq(1)
  end

  it "replaces an 'error' end with a later manual end, without queueing again" do
    end_session('error')

    end_session('manual_candidate')

    expect(session.reload.end_reason).to eq('manual_candidate')
    expect(PortfolioGeneratorWorker.jobs.size).to eq(1)
  end

  it "never replaces a clean end with 'error'" do
    end_session('all_covered')

    end_session('error')

    expect(session.reload.end_reason).to eq('all_covered')
  end

  it "records an unknown reason as 'manual_assessor' rather than failing" do
    end_session('bored')

    expect(session.reload.end_reason).to eq('manual_assessor')
  end

  it 'leaves the duration empty for a session that never started' do
    session.update!(status: 'pending', started_at: nil)

    end_session('manual_assessor')

    expect(session.reload.duration_seconds).to be_nil
  end

  it 'keeps an existing portfolio instead of creating another' do
    existing = create(:portfolio, session:, generation_status: 'failed')

    end_session('manual_assessor')

    expect(session.reload.portfolio).to eq(existing)
  end

  it 'still ends the session when the live status update cannot be published' do
    allow(Redis).to receive(:new).and_raise(Redis::CannotConnectError, 'redis down')

    end_session('manual_candidate')

    expect(session.reload.status).to eq('ended')
    expect(PortfolioGeneratorWorker.jobs.size).to eq(1)
  end
end
