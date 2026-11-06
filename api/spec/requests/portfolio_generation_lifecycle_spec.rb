# frozen_string_literal: true

require 'rails_helper'

# W10: observed locally on 2026-11-06. A portfolio job from an older request failed, was retried by
# Sidekiq, and finished *after* a newer regeneration had completed, silently replacing the newer result.
# These specs drive both jobs by hand so the order is deterministic.
RSpec.describe 'Portfolio generation lifecycle', type: :request do
  let(:org)        { create_org }
  let(:assessment) { create_assessment(org: org) }
  let(:session)    { create_interviewed_session(org: org, assessment: assessment) }

  let(:quote_a) { 'For a live feed, context gets painful fast because every update re-renders every consumer.' }
  let(:quote_b) { 'I moved the feed into a store so components subscribe to just the slice they need.' }
  let(:transient_error) { Gemini::HttpClient::ApiError.new('API returned 503', status: 503) }

  def current_skills
    session.reload.portfolio.portfolio_skills.reload
  end

  # Request A: the session ends and the first portfolio job is enqueued. Its first attempt fails.
  def request_a_and_fail_first_attempt
    Sessions::EndHandler.new(session).call(reason: 'all_covered')
    args_a = last_enqueued_args(PortfolioGeneratorWorker)
    stub_gemini(transient_error)
    expect { run_job(PortfolioGeneratorWorker, args_a) }.to raise_error(Gemini::HttpClient::ApiError)
    args_a
  end

  # Request B: A's scheduled retry has not run for over 30 minutes (queue congestion, lost retry),
  # so the assessor is allowed to recover with Regenerate, and that job succeeds.
  def request_b_and_succeed
    session.portfolio.generations.find_by(sequence: 1).update!(started_at: 31.minutes.ago)
    post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: auth_headers(org)
    expect(response).to have_http_status(:ok)
    args_b = last_enqueued_args(PortfolioGeneratorWorker)
    stub_gemini(model_output(level: 3, quote: quote_b))
    run_job(PortfolioGeneratorWorker, args_b)
    args_b
  end

  it 'does not let a late retry of an older request replace a newer completed result (W10)' do
    args_a = request_a_and_fail_first_attempt
    request_b_and_succeed

    expect(current_skills.map(&:ai_level)).to eq([3])
    expect(current_skills.first.evidence).to eq([quote_b])

    # Sidekiq now retries request A's job. Its (stale) output must not become the current result.
    stub_gemini(model_output(level: 1, quote: quote_a))
    run_job(PortfolioGeneratorWorker, args_a)

    expect(current_skills.map(&:ai_level)).to eq([3])
    expect(current_skills.first.evidence).to eq([quote_b])
  end

  it 'keeps the assessor override when a late retry runs after it was saved (D4 via W10)' do
    args_a = request_a_and_fail_first_attempt
    request_b_and_succeed

    skill = current_skills.first
    post "/api/v1/portfolio_skills/#{skill.id}/override",
         params: { override: { override_level: 4, assessor_notes: 'Stronger than rated' } },
         headers: auth_headers(org)
    expect(response).to have_http_status(:created)

    stub_gemini(model_output(level: 1, quote: quote_a))
    run_job(PortfolioGeneratorWorker, args_a)

    overrides = AssessorOverride.joins(portfolio_skill: :portfolio).where(portfolios: { session_id: session.id })
    expect(overrides.count).to eq(1)
    expect(overrides.first.override_level).to eq(4)
  end

  it 'keeps the last published result when an administrative re-score fails permanently' do
    Sessions::EndHandler.new(session).call(reason: 'all_covered')
    stub_gemini(model_output(level: 3, quote: quote_b))
    run_job(PortfolioGeneratorWorker, last_enqueued_args(PortfolioGeneratorWorker))

    portfolio = session.reload.portfolio
    rescore = Portfolios::RequestGeneration.new(portfolio: portfolio, source: 'admin_rescore', enqueue: false).call
    stub_gemini(Gemini::HttpClient::ApiError.new('API returned 404', status: 404,
                                                 body: { error: { message: 'models/x is not found' } }.to_json))
    run_job(PortfolioGeneratorWorker, [session.id, rescore.id]) # permanent: no raise, no retry

    portfolio.reload
    expect(portfolio.latest_generation).to have_attributes(status: 'failed', error_code: 'model_unavailable')
    expect(portfolio.current_generation.sequence).to eq(1)
    expect(current_skills.map(&:ai_level)).to eq([3])
    expect(portfolio.generation_status).to eq('complete')
  end

  it 'publishes a valid intermediate result while an even newer request is still running' do
    Sessions::EndHandler.new(session).call(reason: 'all_covered')
    args_1 = last_enqueued_args(PortfolioGeneratorWorker)
    portfolio = session.reload.portfolio
    # Generation 1's first attempt failed transiently and is waiting for its Sidekiq retry,
    # so the assessor is allowed to request generation 2.
    portfolio.generations.find_by(sequence: 1).update!(status: 'retrying')
    gen_2 = Portfolios::RequestGeneration.new(portfolio: portfolio, source: 'assessor_regenerate', enqueue: false).call

    stub_gemini(model_output(level: 2, quote: quote_a))
    run_job(PortfolioGeneratorWorker, args_1)
    expect(portfolio.reload.current_generation.sequence).to eq(1) # newest *successful* wins for now

    stub_gemini(model_output(level: 3, quote: quote_b))
    run_job(PortfolioGeneratorWorker, [session.id, gen_2.id])
    expect(portfolio.reload.current_generation.sequence).to eq(2)
    expect(current_skills.map(&:ai_level)).to eq([3])
  end

  it 'does nothing when the same generation job runs twice' do
    Sessions::EndHandler.new(session).call(reason: 'all_covered')
    args = last_enqueued_args(PortfolioGeneratorWorker)
    stub_gemini(model_output(level: 3, quote: quote_b), model_output(level: 1, quote: quote_a))
    run_job(PortfolioGeneratorWorker, args)
    run_job(PortfolioGeneratorWorker, args)

    expect(current_skills.map(&:ai_level)).to eq([3])
    expect(session.reload.portfolio.all_portfolio_skills.count).to eq(1)
  end

  it 'refuses Regenerate while the first scoring run is still queued' do
    Sessions::EndHandler.new(session).call(reason: 'all_covered')

    post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: auth_headers(org)

    expect(response).to have_http_status(:conflict)
    expect(session.reload.portfolio.generations.count).to eq(1)
  end

  it 'lets the assessor regenerate when a run was left "running" by a worker that died' do
    Sessions::EndHandler.new(session).call(reason: 'all_covered')
    session.reload.portfolio.generations.first.update!(status: 'running', started_at: 11.minutes.ago)

    post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: auth_headers(org)

    expect(response).to have_http_status(:ok)
    expect(session.reload.portfolio.generations.count).to eq(2)
  end

  it 'never turns a published generation back into "retrying" when a second worker fails late' do
    Sessions::EndHandler.new(session).call(reason: 'all_covered')
    generation = session.reload.portfolio.generations.first
    # Worker A claimed this run 11 minutes ago and is still busy, so worker B may reclaim it.
    generation.update!(status: 'running', started_at: 11.minutes.ago)

    # While B waits on Gemini, A finishes and publishes the run; then B's call fails transiently.
    worker_a_publishes = lambda do
      generation.portfolio.update!(current_generation: generation, generation_status: 'complete')
      generation.update!(status: 'succeeded', finished_at: Time.current)
      raise Gemini::HttpClient::ApiError.new('API returned 503', status: 503)
    end
    allow(Gemini::HttpClient).to receive(:new).and_return(double(generate_content: nil).tap do |fake|
      allow(fake).to receive(:generate_content) { worker_a_publishes.call }
    end)

    expect { run_job(PortfolioGeneratorWorker, [session.id, generation.id]) }.to raise_error(Gemini::HttpClient::ApiError)
    expect(generation.reload.status).to eq('succeeded')
  end

  it 'does not let a stale worker interfere with the worker that reclaimed its run' do
    Sessions::EndHandler.new(session).call(reason: 'all_covered')
    generation = session.reload.portfolio.generations.first
    worker_b = Portfolios::Generator.new(generation: PortfolioGeneration.find(generation.id),
                                         gemini_client: TestData::FakeGemini.new(model_output(level: 3, quote: quote_b)))

    # Worker A claims the run, then hangs on Gemini for over 10 minutes. Worker B reclaims it.
    # Then A's call finally fails with a temporary error.
    a_hangs_then_fails = lambda do
      PortfolioGeneration.where(id: generation.id).update_all(started_at: 11.minutes.ago)
      expect(worker_b.send(:claim!)).to be(true)
      raise Gemini::HttpClient::ApiError.new('API returned 503', status: 503)
    end
    client_a = Object.new.tap { |c| c.define_singleton_method(:generate_content) { |*| a_hangs_then_fails.call } }
    worker_a = Portfolios::Generator.new(generation: PortfolioGeneration.find(generation.id), gemini_client: client_a)

    expect { worker_a.call }.to raise_error(Gemini::HttpClient::ApiError)
    expect(generation.reload.status).to eq('running') # still B's run; A no longer owns it

    # B now finishes its own run normally.
    worker_b.send(:publish!, model_output(level: 3, quote: quote_b))
    expect(generation.reload.status).to eq('succeeded')
    expect(current_skills.map(&:ai_level)).to eq([3])
  end

  it 'does not let a stale worker publish after its run was reclaimed, even if its call succeeds' do
    Sessions::EndHandler.new(session).call(reason: 'all_covered')
    generation = session.reload.portfolio.generations.first
    worker_b = Portfolios::Generator.new(generation: PortfolioGeneration.find(generation.id),
                                         gemini_client: TestData::FakeGemini.new)

    # A claims, hangs past the 10-minute window, B reclaims, then A's Gemini call succeeds (with L1).
    a_hangs_then_succeeds = lambda do
      PortfolioGeneration.where(id: generation.id).update_all(started_at: 11.minutes.ago)
      expect(worker_b.send(:claim!)).to be(true)
      model_output(level: 1, quote: quote_a)
    end
    client_a = Object.new.tap { |c| c.define_singleton_method(:generate_content) { |*| a_hangs_then_succeeds.call } }
    Portfolios::Generator.new(generation: PortfolioGeneration.find(generation.id), gemini_client: client_a).call

    expect(generation.reload.status).to eq('running') # A lost ownership, so its result is not published
    expect(session.reload.portfolio.current_generation).to be_nil

    worker_b.send(:publish!, model_output(level: 3, quote: quote_b))
    expect(generation.reload.status).to eq('succeeded')
    expect(current_skills.map(&:ai_level)).to eq([3])
  end

  it 'does not leave a blocking queued run when the job cannot be enqueued' do
    Sessions::EndHandler.new(session).call(reason: 'all_covered')
    first = session.reload.portfolio.generations.first
    first.update!(status: 'retrying')
    Portfolios::Generator.mark_exhausted!(first, 'Failed after 6 retries')

    allow(PortfolioGeneratorWorker).to receive(:perform_async).and_raise(RedisClient::CannotConnectError, 'Redis down')
    post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: auth_headers(org)
    expect(response).to have_http_status(:service_unavailable)
    expect(session.reload.portfolio.latest_generation).to have_attributes(status: 'failed', error_code: 'enqueue_failed')

    allow(PortfolioGeneratorWorker).to receive(:perform_async).and_call_original
    post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: auth_headers(org)
    expect(response).to have_http_status(:ok)
  end

  it 'still ends the interview when the first scoring job cannot be enqueued' do
    allow(PortfolioGeneratorWorker).to receive(:perform_async).and_raise(RedisClient::CannotConnectError, 'Redis down')

    expect { Sessions::EndHandler.new(session).call(reason: 'all_covered') }.not_to raise_error

    portfolio = session.reload.portfolio
    expect(session.status).to eq('ended')
    expect(portfolio.generation_status).to eq('failed')
    expect(portfolio.latest_generation.error_code).to eq('enqueue_failed')
  end

  describe 'Regenerate is for recovering a failed process, not for re-rolling a finished report' do
    def end_and_publish
      Sessions::EndHandler.new(session).call(reason: 'all_covered')
      stub_gemini(model_output(level: 3, quote: quote_b))
      run_job(PortfolioGeneratorWorker, last_enqueued_args(PortfolioGeneratorWorker))
    end

    def end_and_fail_with(error)
      Sessions::EndHandler.new(session).call(reason: 'all_covered')
      stub_gemini(error)
      run_job(PortfolioGeneratorWorker, last_enqueued_args(PortfolioGeneratorWorker))
    end

    def regenerate
      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: auth_headers(org)
    end

    it 'refuses Regenerate on a successful report (disagreement goes through Override)' do
      end_and_publish
      regenerate
      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body).dig('errors', 0, 'code')).to eq('report_exists')
      expect(session.reload.portfolio.generations.count).to eq(1)
    end

    it 'refuses Regenerate while an automatic retry is pending, and shows it as in progress' do
      Sessions::EndHandler.new(session).call(reason: 'all_covered')
      stub_gemini(transient_error)
      expect { run_job(PortfolioGeneratorWorker, last_enqueued_args(PortfolioGeneratorWorker)) }
        .to raise_error(Gemini::HttpClient::ApiError)

      expect(session.reload.portfolio.generation_status).to eq('generating')
      regenerate
      expect(response).to have_http_status(:conflict)
    end

    it 'allows Regenerate once a pending retry has been silent for over 30 minutes' do
      Sessions::EndHandler.new(session).call(reason: 'all_covered')
      session.reload.portfolio.generations.first.update!(status: 'retrying', started_at: 31.minutes.ago)
      regenerate
      expect(response).to have_http_status(:ok)
    end

    it 'allows Regenerate after automatic retries are exhausted' do
      Sessions::EndHandler.new(session).call(reason: 'all_covered')
      first = session.reload.portfolio.generations.first
      first.update!(status: 'retrying')
      Portfolios::Generator.mark_exhausted!(first, 'Failed after 6 retries: API returned 503')

      expect(first.reload).to have_attributes(status: 'failed', error_code: 'retries_exhausted')
      expect(session.reload.portfolio.generation_status).to eq('failed')
      regenerate
      expect(response).to have_http_status(:ok)
    end

    it 'blocks Regenerate after a model error until the configuration changes' do
      end_and_fail_with(Gemini::HttpClient::ApiError.new('API returned 404', status: 404,
                                                         body: { error: { message: 'model is no longer available to new users' } }.to_json))
      expect(session.reload.portfolio.latest_generation.error_code).to eq('model_unavailable')

      regenerate
      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body).dig('errors', 0, 'code')).to eq('needs_admin')

      stub_const('ENV', ENV.to_h.merge('GEMINI_PRO_MODEL' => 'admin-updated-test-model'))
      regenerate
      expect(response).to have_http_status(:ok), response.body
    end

    it 'unblocks an authentication error when the credential changes, even with the same model' do
      end_and_fail_with(Gemini::HttpClient::ApiError.new('API returned 403', status: 403,
                                                         body: { error: { message: 'API key not valid' } }.to_json))
      expect(session.reload.portfolio.latest_generation.error_code).to eq('auth_failed')
      regenerate
      expect(response).to have_http_status(:unprocessable_entity)

      stub_const('ENV', ENV.to_h.merge('GEMINI_API_KEY' => 'rotated-test-key-not-real'))
      regenerate
      expect(response).to have_http_status(:ok)
    end

    it 'never stores the API key itself, only a fingerprint of the configuration' do
      Sessions::EndHandler.new(session).call(reason: 'all_covered')
      generation = session.reload.portfolio.generations.first
      expect(generation.config_fingerprint).to match(/\A[0-9a-f]{16}\z/)
      expect(generation.attributes.values.join(' ')).not_to include(ENV.fetch('GEMINI_API_KEY'))
    end
  end

  describe 'error classification' do
    def run_first_attempt_with(error)
      Sessions::EndHandler.new(session).call(reason: 'all_covered')
      stub_gemini(error)
      run_job(PortfolioGeneratorWorker, last_enqueued_args(PortfolioGeneratorWorker))
    end

    it 'retries a 429 rate limit' do
      error = Gemini::HttpClient::RateLimitError.new('Rate limited', status: 429,
                                                     body: { error: { message: 'Resource has been exhausted (e.g. check quota).' } }.to_json)
      expect { run_first_attempt_with(error) }.to raise_error(Gemini::HttpClient::RateLimitError)
      expect(session.reload.portfolio.latest_generation).to have_attributes(status: 'retrying', error_code: 'rate_limited')
    end

    it 'fails a 429 that says the billing quota is used up, without retrying' do
      error = Gemini::HttpClient::RateLimitError.new('Rate limited', status: 429,
                                                     body: { error: { message: 'You exceeded your current quota, please check your plan and billing details.' } }.to_json)
      expect { run_first_attempt_with(error) }.not_to raise_error
      expect(session.reload.portfolio.latest_generation).to have_attributes(status: 'failed', error_code: 'quota_exhausted')
    end

    it 'retries a network failure that has no HTTP status' do
      error = Gemini::HttpClient::ApiError.new('Gemini API error: Connection refused')
      expect { run_first_attempt_with(error) }.to raise_error(Gemini::HttpClient::ApiError)
      expect(session.reload.portfolio.latest_generation.error_code).to eq('network_error')
    end

    it 'retries malformed model output once, then fails it instead of using every retry' do
      Sessions::EndHandler.new(session).call(reason: 'all_covered')
      args = last_enqueued_args(PortfolioGeneratorWorker)
      stub_gemini('not json at all', 'still not json')
      expect { run_job(PortfolioGeneratorWorker, args) }.to raise_error(Portfolios::Generator::InvalidOutput)
      expect { run_job(PortfolioGeneratorWorker, args) }.not_to raise_error

      expect(session.reload.portfolio.latest_generation).to have_attributes(status: 'failed', error_code: 'invalid_output')
    end

    it 'does not let the retries-exhausted hook fail a run that another worker has reclaimed' do
      Sessions::EndHandler.new(session).call(reason: 'all_covered')
      generation = session.reload.portfolio.generations.first
      generation.update!(status: 'running', started_at: 1.minute.ago, claim_count: 2) # B owns it now

      Portfolios::Generator.mark_exhausted!(generation, 'Failed after 6 retries')

      expect(generation.reload.status).to eq('running')
    end

    it "marks the run failed through Sidekiq's own retries-exhausted hook" do
      Sessions::EndHandler.new(session).call(reason: 'all_covered')
      generation = session.reload.portfolio.generations.first
      generation.update!(status: 'retrying')

      PortfolioGeneratorWorker.sidekiq_retries_exhausted_block.call(
        { 'args' => [session.id, generation.id], 'retry_count' => 6, 'error_message' => 'API returned 503' },
        StandardError.new('API returned 503')
      )

      expect(generation.reload).to have_attributes(status: 'failed', error_code: 'retries_exhausted')
    end

    it 'tells the UI whether Regenerate is offered, and why not' do
      Sessions::EndHandler.new(session).call(reason: 'all_covered')
      stub_gemini(model_output(level: 3, quote: quote_b))
      run_job(PortfolioGeneratorWorker, last_enqueued_args(PortfolioGeneratorWorker))

      get "/api/v1/sessions/#{session.id}/portfolio", headers: auth_headers(org)

      expect(JSON.parse(response.body).dig('portfolio', 'regenerate')).to include('allowed' => false, 'reason' => 'report_exists')
    end

    it 'gives up after 6 automatic retries' do
      expect(PortfolioGeneratorWorker.get_sidekiq_options['retry']).to eq(6)
    end
  end

  describe 'jobs enqueued before generations existed (session_id only)' do
    it 'are skipped when the portfolio already has generations, so they cannot publish over newer work' do
      Sessions::EndHandler.new(session).call(reason: 'all_covered')
      stub_gemini(model_output(level: 3, quote: quote_b))
      run_job(PortfolioGeneratorWorker, last_enqueued_args(PortfolioGeneratorWorker))

      stub_gemini(model_output(level: 1, quote: quote_a))
      run_job(PortfolioGeneratorWorker, [session.id])

      expect(session.reload.portfolio.generations.count).to eq(1)
      expect(current_skills.map(&:ai_level)).to eq([3])
    end

    it 'cannot create a generation once one exists, even if it checked earlier (check and create share one lock)' do
      session.update!(status: 'ended')
      portfolio = session.create_portfolio!(generation_status: 'pending')
      Portfolios::RequestGeneration.new(portfolio: portfolio, source: 'session_end', enqueue: false).call

      skipped = Portfolios::RequestGeneration.new(portfolio: portfolio, source: 'legacy_job', enqueue: false).call

      expect(skipped).to be_nil
      expect(portfolio.generations.count).to eq(1)
    end

    it 'may create the first generation of a portfolio that has none' do
      session.update!(status: 'ended')
      session.create_portfolio!(generation_status: 'pending')
      stub_gemini(model_output(level: 3, quote: quote_b))
      run_job(PortfolioGeneratorWorker, [session.id])

      portfolio = session.reload.portfolio
      expect(portfolio.generations.map(&:source)).to eq(['legacy_job'])
      expect(current_skills.map(&:ai_level)).to eq([3])
    end
  end
end
