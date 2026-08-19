# frozen_string_literal: true

require 'rails_helper'

# List-vs-detail contract for assessments (REL-4): index rows are a lighter
# projection than show — no skills, no system_prompt. See api/docs/contracts.md.
RSpec.describe 'Api::V1::Assessments (list vs detail contract)', type: :request do
  let(:org) { create(:organization, scheme: 'test-corp') }
  let(:admin) { create(:admin_user) }
  let(:headers) { auth_headers(scheme: org.scheme, user: admin) }

  ASSESSMENT_BASE_KEYS = %w[
    id name role_title time_limit_min language
    created_by created_at updated_at latest_session
  ].freeze
  ASSESSMENT_SKILL_KEYS = %w[
    id skill_id skill_label is_custom scope_include scope_exclude
    l1_anchor l2_anchor l3_anchor l4_anchor l5_anchor
    expected_level display_order
  ].freeze

  def assessment_with_skills
    assessment = create(:assessment, tenant_id: org.id, system_prompt: 'You are a strict interviewer.')
    create(:assessment_skill, assessment: assessment)
    assessment
  end

  describe 'GET /api/v1/assessments' do
    it 'returns list rows with the base keys + latest_session, excluding skills and system_prompt' do
      assessment_with_skills

      get '/api/v1/assessments', headers: headers

      expect(response).to have_http_status(:ok)
      row = JSON.parse(response.body)['assessments'].first
      expect_json_keys(row, ASSESSMENT_BASE_KEYS)
      expect(row['skills']).to be_nil
      expect(row['system_prompt']).to be_nil
    end
  end

  describe 'GET /api/v1/assessments/:id' do
    it 'returns the detail shape with system_prompt and the full skills key set' do
      assessment = assessment_with_skills

      get "/api/v1/assessments/#{assessment.id}", headers: headers

      expect(response).to have_http_status(:ok)
      detail = JSON.parse(response.body)['assessment']
      expect_json_keys(detail, ASSESSMENT_BASE_KEYS + %w[system_prompt skills])
      expect(detail['system_prompt']).to eq('You are a strict interviewer.')
      expect_json_keys(detail['skills'].first, ASSESSMENT_SKILL_KEYS)
    end
  end
end
