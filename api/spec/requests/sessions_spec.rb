# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Sessions', type: :request do
  let!(:org) { create(:organization, scheme: 'acme') }
  let(:assessment) { create(:assessment, tenant_id: org.id) }

  describe 'GET index' do
    it 'paginates and returns meta (P5-3)' do
      3.times { create(:session, assessment: assessment, tenant_id: org.id) }

      get "/api/v1/assessments/#{assessment.id}/sessions", headers: bearer_for(organization: org)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body).to have_key('meta')
      expect(body['meta']['total_count']).to eq(3)
      expect(body['sessions'].size).to eq(3)
    end
  end

  describe 'GET transcript' do
    it 'total reflects the whole session, not the from_turn slice (P5-4)' do
      session = create(:session, assessment: assessment, tenant_id: org.id)
      3.times { |i| session.transcript_turns.create!(turn_number: i + 1, speaker: 'candidate', text: "t#{i}") }

      get "/api/v1/sessions/#{session.id}/transcript",
          params: { from_turn: 3 }, headers: bearer_for(organization: org)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['turns'].size).to eq(1)
      expect(body['total']).to eq(3)
    end
  end
end
