# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Assessments', type: :request do
  let(:org) { Organization.find_by(scheme: 'test-corp') || Organization.create!(name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp', host: 'localhost') }
  let(:headers) { auth_headers(scheme: org.scheme) }

  describe 'POST /api/v1/assessments' do
    it 'creates an assessment with nested skills' do
      payload = {
        assessment: {
          name: 'Staff Product Engineer',
          time_limit_min: 45,
          language: 'en',
          assessment_skills_attributes: [
            {
              skill_id: 'SK-ENG-001',
              skill_label: 'React / Frontend Architecture',
              is_custom: false,
              expected_level: 4,
              display_order: 0,
              l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5'
            }
          ]
        }
      }

      post '/api/v1/assessments', params: payload.to_json, headers: headers

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json['assessment']['name']).to eq('Staff Product Engineer')
      expect(json['assessment']['skills'].length).to eq(1)
      expect(json['assessment']['skills'][0]['skill_id']).to eq('SK-ENG-001')
    end
  end

  describe 'PUT /api/v1/assessments/:id' do
    it 'deletes removed skills via _destroy flag' do
      assessment = Assessment.create!(
        tenant_id: org.id,
        created_by: 1,
        name: 'Initial Role',
        time_limit_min: 30
      )
      skill1 = assessment.assessment_skills.create!(
        skill_id: 'SK-ENG-001',
        skill_label: 'React',
        expected_level: 3,
        l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5'
      )
      skill2 = assessment.assessment_skills.create!(
        skill_id: 'SK-ENG-002',
        skill_label: 'Node',
        expected_level: 3,
        l1_anchor: 'L1', l2_anchor: 'L2', l3_anchor: 'L3', l4_anchor: 'L4', l5_anchor: 'L5'
      )

      update_payload = {
        assessment: {
          name: 'Updated Role',
          time_limit_min: 45,
          assessment_skills_attributes: [
            { id: skill1.id, expected_level: 4 },
            { id: skill2.id, _destroy: '1' }
          ]
        }
      }

      put "/api/v1/assessments/#{assessment.id}", params: update_payload.to_json, headers: headers

      expect(response).to have_http_status(:ok)
      assessment.reload
      expect(assessment.assessment_skills.count).to eq(1)
      expect(assessment.assessment_skills.first.id).to eq(skill1.id)
      expect(assessment.assessment_skills.first.expected_level).to eq(4)
    end
  end
end
