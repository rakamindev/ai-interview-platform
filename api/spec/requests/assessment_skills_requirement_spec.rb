# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Assessment skill requirement', type: :request do
  let(:organization) do
    Organization.create!(
      name: 'Assessment Skills Corp',
      scheme: 'assessment-skills-test',
      identifier: 'assessment-skills-test',
      host: 'assessment-skills.test.local'
    )
  end

  let(:token) do
    JsonWebToken.encode(user_id: 1, role: 'admin', scheme: organization.scheme)
  end

  let(:headers) { { 'Authorization' => "Bearer #{token}" } }

  let(:skill_attributes) do
    {
      skill_id: 'react',
      skill_label: 'React',
      is_custom: false,
      l1_anchor: 'L1',
      l2_anchor: 'L2',
      l3_anchor: 'L3',
      l4_anchor: 'L4',
      l5_anchor: 'L5',
      expected_level: 3,
      display_order: 0
    }
  end

  before do
    allow(SystemPromptGeneratorWorker).to receive(:perform_async)
  end

  describe 'POST /api/v1/assessments' do
    it 'rejects an assessment without skills' do
      post '/api/v1/assessments',
           params: {
             assessment: {
               name: 'Empty Assessment',
               time_limit_min: 30,
               assessment_skills_attributes: []
             }
           },
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body).dig('error', 'message')).to eq('Assessment must include at least one skill')
      expect(Assessment.unscoped.where(name: 'Empty Assessment')).not_to exist
    end

    it 'creates an assessment with at least one skill' do
      post '/api/v1/assessments',
           params: {
             assessment: {
               name: 'React Assessment',
               time_limit_min: 30,
               assessment_skills_attributes: [skill_attributes]
             }
           },
           headers: headers

      expect(response).to have_http_status(:created)
      assessment = Assessment.unscoped.find(JSON.parse(response.body).dig('assessment', 'id'))
      expect(assessment.assessment_skills.pluck(:skill_label)).to eq(['React'])
    end
  end

  describe 'PUT /api/v1/assessments/:id' do
    it 'rejects removing the final skill' do
      assessment = Current.using(tenant_id: organization.id) do
        Assessment.create!(
          name: 'Existing Assessment',
          tenant_id: organization.id,
          created_by: 1,
          time_limit_min: 30,
          assessment_skills_attributes: [skill_attributes]
        )
      end
      skill = assessment.assessment_skills.first

      put "/api/v1/assessments/#{assessment.id}",
          params: {
            assessment: {
              assessment_skills_attributes: [{ id: skill.id, _destroy: true }]
            }
          },
          headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body).dig('error', 'message')).to eq('Assessment must include at least one skill')
      expect(assessment.reload.assessment_skills.count).to eq(1)
    end
  end

  describe 'POST /api/v1/assessments/:assessment_id/sessions' do
    it 'rejects invitations for a legacy assessment without skills' do
      assessment = Current.using(tenant_id: organization.id) do
        Assessment.create!(
          name: 'Legacy Empty Assessment',
          tenant_id: organization.id,
          created_by: 1,
          time_limit_min: 30
        )
      end

      post "/api/v1/assessments/#{assessment.id}/sessions",
           params: { session: { candidate_name: 'Candidate' } },
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body).dig('error', 'message')).to eq(
        'Assessment must include at least one skill before inviting a candidate'
      )
      expect(assessment.sessions).to be_empty
    end
  end
end
