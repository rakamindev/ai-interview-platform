# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Session Handlers', type: :service do
  let(:assessment) { create(:assessment) }
  let!(:assessment_skill) { create(:assessment_skill, assessment: assessment, skill_label: 'TypeScript') }
  let(:session) { create(:session, assessment: assessment, status: 'pending') }

  before do
    allow_any_instance_of(Redis).to receive(:publish).and_return(1)
  end

  describe Sessions::StartHandler do
    subject(:handler) { described_class.new(session) }

    it 'activates session and creates coverage map entries' do
      res = handler.call
      expect(res.status).to eq('active')
      expect(res.started_at).to be_present
      expect(session.coverage_maps.count).to eq(1)
      expect(session.coverage_maps.first.skill_label).to eq('TypeScript')
    end

    it 'is idempotent and does not recreate coverage maps' do
      handler.call
      expect { handler.call }.not_to change(CoverageMap, :count)
    end
  end

  describe Sessions::EndHandler do
    subject(:handler) { described_class.new(session) }

    before do
      allow(PortfolioGeneratorWorker).to receive(:perform_async)
    end

    it 'ends session and creates pending portfolio' do
      session.update!(status: 'active', started_at: 5.minutes.ago)
      res = handler.call(reason: 'manual_candidate')

      expect(res.status).to eq('ended')
      expect(res.end_reason).to eq('manual_candidate')
      expect(res.portfolio).to be_present
      expect(res.portfolio.generation_status).to eq('pending')
      expect(PortfolioGeneratorWorker).to have_received(:perform_async).with(session.id)
    end

    it 'upgrades error end_reason to clean manual end_reason' do
      session.update!(status: 'ended', end_reason: 'error', ended_at: Time.current)
      handler.call(reason: 'manual_assessor')
      expect(session.reload.end_reason).to eq('manual_assessor')
    end
  end
end
