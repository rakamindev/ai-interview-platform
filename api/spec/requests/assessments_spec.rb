# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Assessments (assessor-facing)' do
  let(:auth) { auth_headers(role: 'admin') }
  let(:headers) { auth[0] }
  let(:org) { auth[1] }

  context 'POST /api/v1/assessments' do
    it 'creates an assessment and queues system prompt generation' do
      post '/api/v1/assessments', params: {
        assessment: {
          name: 'Frontend Engineer',
          time_limit_min: 30,
          language: 'id',
          assessment_skills_attributes: [
            {
              skill_label: 'React / Frontend Development',
              skill_id: 'SK-ENG-001',
              is_custom: false,
              l1_anchor: 'Executes with guidance',
              l2_anchor: 'Independent on routine scope',
              l3_anchor: 'Complex scope',
              l4_anchor: 'Defines standards',
              l5_anchor: 'Org authority',
              expected_level: 3,
              display_order: 0
            }
          ]
        }
      }.to_json, headers: headers.merge('Content-Type' => 'application/json')

      expect(response).to have_http_status(:created)
      expect(SystemPromptGeneratorWorker.jobs.size).to eq(1)
      body = response.parsed_body['assessment']
      expect(body['skills'].first['skill_label']).to eq('React / Frontend Development')
    end

    it 'rejects invalid time limits (contract from the schema)' do
      post '/api/v1/assessments', params: {
        assessment: { name: 'X', time_limit_min: 5, assessment_skills_attributes: [] }
      }.to_json, headers: headers.merge('Content-Type' => 'application/json')

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'rejects duplicate skill labels in one request (coverage would be ambiguous)' do
      nested = [
        { skill_label: 'React / Frontend Development', is_custom: false, l1_anchor: 'a', l2_anchor: 'b', l3_anchor: 'c', l4_anchor: 'd', l5_anchor: 'e', expected_level: 3, display_order: 0 },
        { skill_label: 'React / Frontend Development', is_custom: false, l1_anchor: 'a', l2_anchor: 'b', l3_anchor: 'c', l4_anchor: 'd', l5_anchor: 'e', expected_level: 4, display_order: 1 }
      ]
      post '/api/v1/assessments', params: {
        assessment: { name: 'X', time_limit_min: 30, assessment_skills_attributes: nested }
      }.to_json, headers: headers.merge('Content-Type' => 'application/json')

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body['errors'].first['message']).to match(/has already been added/i)
    end
  end

  context 'DELETE /api/v1/assessments/:id' do
    let(:assessment) { with_tenant(org) { create(:assessment) } }
    let(:session) { with_tenant(org) { create(:session, assessment: assessment, status: 'active') } }

    it 'deletes an assessment that has no sessions' do
      delete "/api/v1/assessments/#{assessment.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(with_tenant(org) { Assessment.find_by(id: assessment.id) }).to be_nil
    end

    it 'refuses to delete an assessment that has sessions (data integrity)' do
      session # force creation

      delete "/api/v1/assessments/#{assessment.id}", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body['errors'].first['message']).to match(/dependent sessions/i)
      expect(with_tenant(org) { Assessment.find(assessment.id) }).to be_present
    end
  end

  context 'tenant isolation across assessments' do
    let!(:other_org) { create(:organization) }

    it 'an assessor from one tenant cannot list another tenant\'s assessment' do
      other = with_tenant(other_org) { create(:assessment, name: 'Secret Assess') }

      get '/api/v1/assessments', headers: headers

      expect(response).to have_http_status(:ok)
      ids = response.parsed_body['assessments'].map { |a| a['id'] }
      expect(ids).not_to include(other.id)
    end
  end
end