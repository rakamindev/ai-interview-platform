# frozen_string_literal: true

require 'rails_helper'

# Real connections exercise the generation lock against a reclaim during failure.
RSpec.describe 'Reclaim during portfolio failure', type: :request do
  self.use_transactional_tests = false

  let!(:org)        { create_org(scheme: "reclaim-#{SecureRandom.hex(3)}") }
  let!(:assessment) { create_assessment(org: org) }
  let!(:session)    { create_interviewed_session(org: org, assessment: assessment) }
  let(:quote)       { 'I moved the feed into a store so components subscribe to just the slice they need.' }

  after do
    @reclaim_thread&.join(3)
    portfolio = session.reload.portfolio
    if portfolio
      AssessorOverride.where(portfolio_skill_id: PortfolioSkill.where(portfolio_id: portfolio.id).select(:id)).delete_all
      PortfolioSkill.where(portfolio_id: portfolio.id).delete_all
      Portfolio.where(id: portfolio.id).update_all(current_generation_id: nil)
      PortfolioGeneration.where(portfolio_id: portfolio.id).delete_all
      portfolio.delete
    end
    TranscriptTurn.where(session_id: session.id).delete_all
    CoverageMap.where(session_id: session.id).delete_all
    Session.unscoped.where(id: session.id).delete_all
    AssessmentSkill.where(assessment_id: assessment.id).delete_all
    Assessment.unscoped.where(id: assessment.id).delete_all
    Organization.where(id: org.id).delete_all
  end

  it 'makes a reclaimer wait for failure and refuse the failed run' do
    session.update!(status: 'ended')
    portfolio = session.create_portfolio!(generation_status: 'pending')
    generation = Portfolios::RequestGeneration.new(portfolio: portfolio, source: 'session_end', enqueue: false).call
    run_id = generation.id
    client = Object.new
    client.define_singleton_method(:generate_content) do |*|
      PortfolioGeneration.where(id: run_id).update_all(started_at: 11.minutes.ago)
      raise Gemini::HttpClient::ApiError.new('API returned 400', status: 400)
    end
    worker = Portfolios::Generator.new(generation: PortfolioGeneration.find(run_id), gemini_client: client)
    attempted = Queue.new
    completed = Queue.new
    hook = lambda do
      @reclaim_thread = Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          reclaimer = Portfolios::Generator.new(generation: PortfolioGeneration.find(run_id),
                                                gemini_client: TestData::FakeGemini.new)
          attempted << true
          claimed = reclaimer.send(:claim!)
          completed << true
          claimed
        end
      end
      deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + 0.5
      sleep 0.01 while (attempted.empty? || completed.empty?) && Process.clock_gettime(Process::CLOCK_MONOTONIC) < deadline
    end
    # fail!'s update! comes after terminal/ownership checks, just before the failure write.
    worker.instance_variable_get(:@generation).singleton_class.prepend(Module.new do
      define_method(:update!) do |*args, **kwargs|
        hook.call
        super(*args, **kwargs)
      end
    end)

    worker.call
    expect(attempted.empty?).to be(false)
    expect(@reclaim_thread.join(3)).not_to be_nil
    expect(@reclaim_thread.value).to be(false)
    expect(generation.reload).to have_attributes(claim_count: 1, status: 'failed')
    expect(portfolio.reload.generation_status).to eq('failed')
    expect(portfolio.current_generation_id).to be_nil
  end
end
