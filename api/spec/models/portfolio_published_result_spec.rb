# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolio, '#published_result?', type: :model do
  let!(:org) { Organization.create!(id: 310, scheme: 'test-org', name: 'Test Org', identifier: 'test-org', host: 'localhost') }
  let!(:assessment) { Assessment.unscoped.create!(tenant_id: org.id, name: 'Published Spec Assessment', created_by: 1, time_limit_min: 30) }
  let!(:session) { Session.unscoped.create!(tenant_id: org.id, assessment_id: assessment.id, candidate_id: 910, status: 'ended') }
  let!(:portfolio) { session.create_portfolio!(candidate_id: session.candidate_id, generation_status: 'pending') }

  it 'A. returns true when generated_at is present and portfolio skills exist' do
    portfolio.update!(generated_at: Time.current)
    portfolio.portfolio_skills.create!(
      skill_label: 'Skill 1',
      ai_level: 3,
      ai_confidence: 'high',
      competency_summary: 'Summary',
      evidence: ['Quote']
    )

    expect(portfolio.published_result?).to be true
  end

  it 'B. returns false when generated_at is nil even if partial skills exist' do
    portfolio.update!(generated_at: nil)
    portfolio.portfolio_skills.create!(
      skill_label: 'Partial Skill',
      ai_level: 2,
      ai_confidence: 'low',
      competency_summary: 'Summary',
      evidence: ['Quote']
    )

    expect(portfolio.published_result?).to be false
  end

  it 'C. returns false when generated_at is present but no skills exist' do
    portfolio.update!(generated_at: Time.current)
    portfolio.portfolio_skills.destroy_all

    expect(portfolio.published_result?).to be false
  end

  describe 'Legacy partial rows handling during failure' do
    it 'D. marks status as failed (not complete) when generation fails with legacy partial rows' do
      # Legacy state: partial skills exist, but generated_at was never set (generation previously crashed mid-way)
      portfolio.update!(generated_at: nil, generation_status: 'generating')
      portfolio.portfolio_skills.create!(
        skill_label: 'Orphaned Partial Skill',
        ai_level: 1,
        ai_confidence: 'low',
        competency_summary: 'Partial summary',
        evidence: []
      )

      mock_gemini_client = instance_double(Gemini::HttpClient)
      allow(mock_gemini_client).to receive(:generate_content).and_raise(Gemini::HttpClient::ApiError, 'AI Timeout')

      generator = Portfolios::Generator.new(session: session, gemini_client: mock_gemini_client)
      expect { generator.call }.to raise_error(Gemini::HttpClient::ApiError)

      portfolio.reload
      expect(portfolio.generation_status).to eq('failed')
      expect(portfolio.generation_error).to eq('Evaluation generation failed.')
    end

    it 'E. marks status as failed when retries are exhausted with legacy partial rows' do
      portfolio.update!(generated_at: nil, generation_status: 'generating')
      portfolio.portfolio_skills.create!(
        skill_label: 'Orphaned Partial Skill',
        ai_level: 1,
        ai_confidence: 'low',
        competency_summary: 'Partial summary',
        evidence: []
      )

      msg = { 'args' => [session.id], 'retry_count' => 3, 'error_message' => 'Timeout' }
      PortfolioGeneratorWorker.sidekiq_retries_exhausted_block.call(msg, StandardError.new('Timeout'))

      portfolio.reload
      expect(portfolio.generation_status).to eq('failed')
      expect(portfolio.generation_error).to eq('Evaluation generation permanently failed.')
    end
  end
end
