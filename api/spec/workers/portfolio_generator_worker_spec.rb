# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioGeneratorWorker, type: :worker do
  let!(:org) { Organization.create!(id: 250, scheme: 'test-org', name: 'Test Org', identifier: 'test-org', host: 'localhost') }
  let!(:assessment) { Assessment.unscoped.create!(tenant_id: org.id, name: 'Worker Assessment', created_by: 1, time_limit_min: 30) }
  let!(:session) { Session.unscoped.create!(tenant_id: org.id, assessment_id: assessment.id, candidate_id: 850, status: 'ended') }
  let!(:portfolio) { session.create_portfolio!(candidate_id: session.candidate_id, generation_status: 'pending') }

  describe '#perform and Current context lifecycle (WORKER-AC-01 through WORKER-AC-03)' do
    it 'derives tenant_id from persisted Session and enters Current context' do
      generator_double = instance_double(Portfolios::Generator)
      expect(generator_double).to receive(:call) do
        expect(Current.tenant_id).to eq(org.id)
      end

      allow(Portfolios::Generator).to receive(:new).with(session: session).and_return(generator_double)

      described_class.new.perform(session.id)
    end

    it 'restores pre-existing Current context after successful execution' do
      RequestStore.store[:tenant_id] = 999

      allow_any_instance_of(Portfolios::Generator).to receive(:call).and_return(portfolio)
      described_class.new.perform(session.id)

      expect(RequestStore.store[:tenant_id]).to eq(999)
    end

    it 'restores pre-existing Current context after exception' do
      RequestStore.store[:tenant_id] = 999

      allow_any_instance_of(Portfolios::Generator).to receive(:call).and_raise(StandardError, 'API failure')
      expect {
        described_class.new.perform(session.id)
      }.to raise_error(StandardError, 'API failure')

      expect(RequestStore.store[:tenant_id]).to eq(999)
    end
  end

  describe 'sidekiq_retries_exhausted hook' do
    it 'preserves complete status and existing skills when regeneration retries are exhausted' do
      portfolio.update!(generation_status: 'complete', generated_at: 1.hour.ago)
      portfolio.portfolio_skills.create!(
        skill_label: 'Skill 1',
        ai_level: 4,
        ai_confidence: 'high',
        competency_summary: 'Summary 1',
        evidence: ['Quote 1']
      )

      # Trigger exhausted hook
      msg = { 'args' => [session.id], 'retry_count' => 3, 'error_message' => 'Timeout' }
      PortfolioGeneratorWorker.sidekiq_retries_exhausted_block.call(msg, StandardError.new('Timeout'))

      portfolio.reload
      expect(portfolio.generation_status).to eq('complete')
      expect(portfolio.portfolio_skills.count).to eq(1)
      expect(portfolio.generation_error).to eq('Regeneration failed after retries. Preserved previous results.')
    end

    it 'marks status as failed when initial generation retries are exhausted' do
      portfolio.update!(generation_status: 'generating', generated_at: nil)

      msg = { 'args' => [session.id], 'retry_count' => 3, 'error_message' => 'Timeout' }
      PortfolioGeneratorWorker.sidekiq_retries_exhausted_block.call(msg, StandardError.new('Timeout'))

      portfolio.reload
      expect(portfolio.generation_status).to eq('failed')
      expect(portfolio.generation_error).to eq('Evaluation generation permanently failed.')
    end
  end
end
