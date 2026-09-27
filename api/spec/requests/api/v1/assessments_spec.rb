# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Assessments API Characterization', type: :request do
  let!(:org) { create(:organization, scheme: 'test-corp') }
  let!(:admin) { create(:user, :admin) }
  let(:headers) { authenticated_headers(admin, scheme: org.scheme) }

  before do
    allow(SystemPromptGeneratorWorker).to receive(:perform_async)
  end

  describe 'POST /api/v1/assessments' do
    let(:valid_params) do
      {
        assessment: {
          name: 'Staff Backend Architect',
          time_limit_min: 45,
          language: 'en'
        }
      }
    end

    it 'creates an assessment and enqueues prompt generator worker' do
      post '/api/v1/assessments',
           params: valid_params.to_json,
           headers: headers

      expect(response).to have_http_status(:created)
      expect(SystemPromptGeneratorWorker).to have_received(:perform_async)
    end

    it 'characterizes GAP P2-5: returns system_prompt_generated: true synchronously before worker runs' do
      post '/api/v1/assessments',
           params: valid_params.to_json,
           headers: headers

      expect(response).to have_http_status(:created)
      expect(json_body[:system_prompt_generated]).to be true
    end

    it 'characterizes GAP P3-3: create returns raw model JSON without skills, unlike index/show' do
      post '/api/v1/assessments',
           params: valid_params.to_json,
           headers: headers

      expect(response).to have_http_status(:created)
      expect(json_body[:assessment]).to have_key(:id)
      expect(json_body[:assessment]).to have_key(:name)
      expect(json_body[:assessment]).not_to have_key(:skills)
    end
  end
end
