# frozen_string_literal: true

require 'rails_helper'

# Real concurrency needs separate DB connections, so this file opts out of transactional tests
# and cleans up after itself.
RSpec.describe 'Portfolio generation requests under concurrency', type: :request do
  self.use_transactional_tests = false

  let!(:org)        { create_org(scheme: "concurrency-#{SecureRandom.hex(3)}") }
  let!(:assessment) { create_assessment(org: org) }
  let!(:session)    { create_interviewed_session(org: org, assessment: assessment) }
  let!(:portfolio)  { session.update!(status: 'ended') && session.create_portfolio!(generation_status: 'pending') }

  after do
    PortfolioSkill.where(portfolio_id: portfolio.id).delete_all
    Portfolio.where(id: portfolio.id).update_all(current_generation_id: nil)
    PortfolioGeneration.where(portfolio_id: portfolio.id).delete_all
    Portfolio.where(id: portfolio.id).delete_all
    TranscriptTurn.where(session_id: session.id).delete_all
    CoverageMap.where(session_id: session.id).delete_all
    Session.unscoped.where(id: session.id).delete_all
    AssessmentSkill.where(assessment_id: assessment.id).delete_all
    Assessment.unscoped.where(id: assessment.id).delete_all
    Organization.where(id: org.id).delete_all
  end

  it 'assigns distinct, gap-free sequences to simultaneous requests' do
    start = Queue.new
    threads = Array.new(5) do
      Thread.new do
        start.pop
        ActiveRecord::Base.connection_pool.with_connection do
          Portfolios::RequestGeneration.new(portfolio: Portfolio.find(portfolio.id), source: 'session_end',
                                            enqueue: false).call.sequence
        end
      end
    end
    5.times { start << :go }

    expect(threads.map(&:value).sort).to eq([1, 2, 3, 4, 5])
  end

  it 'never lets a racing legacy job get a higher sequence than a modern request' do
    10.times do
      PortfolioGeneration.where(portfolio_id: portfolio.id).delete_all
      start = Queue.new
      threads = %w[session_end legacy_job].map do |source|
        Thread.new do
          start.pop
          ActiveRecord::Base.connection_pool.with_connection do
            Portfolios::RequestGeneration.new(portfolio: Portfolio.find(portfolio.id), source: source, enqueue: false).call
          end
        end
      end
      2.times { start << :go }
      threads.each(&:join)

      by_source = PortfolioGeneration.where(portfolio_id: portfolio.id).pluck(:source, :sequence).to_h
      expect(by_source['legacy_job']).to eq(1).or be_nil # only ever the very first run, never after modern work
    end
  end
end
