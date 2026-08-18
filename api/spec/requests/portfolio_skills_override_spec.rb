# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolio skill override', type: :request do
  let(:tenant_id) { 9_111 }

  before do
    stub_assessor_auth!(tenant_id: tenant_id)
    allow(FitGapGeneratorWorker).to receive(:perform_async)
  end

  def skill_record
    session = create_ended_session!(tenant_id: tenant_id)
    portfolio = create_portfolio!(session: session, status: 'complete')
    create_portfolio_skill!(portfolio, ai_level: 2)
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    it 'creates an override with audit fields and the human level' do
      skill = skill_record

      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params: { override: { override_level: 4, assessor_notes: 'Stronger than AI rated.' } },
           as: :json

      expect(response).to have_http_status(:created)
      body = json_body.fetch('override')
      expect(body['override_level']).to eq(4)
      expect(body['ai_level']).to eq(2)
      expect(body['assessor_notes']).to eq('Stronger than AI rated.')
      expect(body['overridden_by']).to eq(1)
      expect(body['overridden_at']).to be_present
    end

    it 'updates an existing override instead of duplicating it' do
      skill = skill_record
      skill.create_assessor_override!(
        ai_level: 2,
        override_level: 3,
        overridden_by: 1,
        assessor_notes: 'first'
      )

      expect do
        post "/api/v1/portfolio_skills/#{skill.id}/override",
             params: { override: { override_level: 5, assessor_notes: 'revised' } },
             as: :json
      end.not_to change(AssessorOverride, :count)

      expect(response).to have_http_status(:ok)
      expect(json_body.dig('override', 'override_level')).to eq(5)
      expect(json_body.dig('override', 'assessor_notes')).to eq('revised')
    end

    it 'rejects an out-of-range override_level' do
      skill = skill_record

      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params: { override: { override_level: 9 } },
           as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body.dig('errors', 0, 'message')).to be_present
    end
  end
end
