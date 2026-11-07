# frozen_string_literal: true

require 'rails_helper'

# G3 AC7: an assessor saving an override while a new generation is being published must never end up
# with a lost or duplicated decision. Needs real separate DB connections, so no transactional tests.
RSpec.describe 'Override save racing generation promotion', type: :request do
  self.use_transactional_tests = false

  let!(:org)        { create_org(scheme: "ovr-#{SecureRandom.hex(3)}") }
  let!(:assessment) { create_assessment(org: org) }
  let!(:session)    { create_interviewed_session(org: org, assessment: assessment) }
  let(:quote)       { 'I moved the feed into a store so components subscribe to just the slice they need.' }

  after do
    pf = Portfolio.find_by(session_id: session.id)
    if pf
      AssessorOverride.where(portfolio_skill_id: PortfolioSkill.where(portfolio_id: pf.id).select(:id)).delete_all
      PortfolioSkill.where(portfolio_id: pf.id).delete_all
      Portfolio.where(id: pf.id).update_all(current_generation_id: nil)
      PortfolioGeneration.where(portfolio_id: pf.id).delete_all
      pf.delete
    end
    TranscriptTurn.where(session_id: session.id).delete_all
    CoverageMap.where(session_id: session.id).delete_all
    Session.unscoped.where(id: session.id).delete_all
    AssessmentSkill.where(assessment_id: assessment.id).delete_all
    Assessment.unscoped.where(id: assessment.id).delete_all
    Organization.where(id: org.id).delete_all
  end

  it 'keeps exactly one override, on the current skill, whichever operation wins the lock' do
    session.update!(status: 'ended')
    portfolio = session.create_portfolio!(generation_status: 'pending')
    first = Portfolios::RequestGeneration.new(portfolio: portfolio, source: 'session_end', enqueue: false).call
    Portfolios::Generator.new(generation: first, gemini_client: TestData::FakeGemini.new(model_output(level: 3, quote: quote))).call
    old_skill = portfolio.reload.portfolio_skills.first
    second = Portfolios::RequestGeneration.new(portfolio: portfolio, source: 'admin_rescore', enqueue: false).call

    gun = Queue.new
    threads = [
      Thread.new do
        gun.pop
        ActiveRecord::Base.connection_pool.with_connection do
          Portfolios::SaveOverride.new(portfolio_skill: PortfolioSkill.find(old_skill.id), override_level: 4,
                                       assessor_notes: 'race', user_id: 1).call
        end
      end,
      Thread.new do
        gun.pop
        ActiveRecord::Base.connection_pool.with_connection do
          Portfolios::Generator.new(generation: PortfolioGeneration.find(second.id),
                                    gemini_client: TestData::FakeGemini.new(model_output(level: 3, quote: quote))).call
        end
      end
    ]
    2.times { gun << :go }
    threads.each(&:join)

    overrides = AssessorOverride.where(portfolio_skill_id: PortfolioSkill.where(portfolio_id: portfolio.id).select(:id))
    expect(overrides.count).to eq(1)
    expect(overrides.first.override_level).to eq(4)
    expect(overrides.first.portfolio_skill.generation_id).to eq(second.id)
  end
end
