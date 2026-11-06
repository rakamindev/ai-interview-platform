# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Assessment deletion (W28)', type: :request do
  let(:org) { create_org }
  let(:assessment) { create_assessment(org: org) }

  it 'reports a blocked deletion and preserves the assessment, skills and interview' do
    session = create_interviewed_session(org: org, assessment: assessment)
    skill_ids = assessment.assessment_skills.pluck(:id)

    delete "/api/v1/assessments/#{assessment.id}", headers: auth_headers(org)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(JSON.parse(response.body).dig('errors', 0, 'message')).to be_present
    expect(Assessment.unscoped.exists?(assessment.id)).to be(true)
    expect(AssessmentSkill.where(id: skill_ids).count).to eq(skill_ids.size)
    expect(Session.unscoped.exists?(session.id)).to be(true)
  end

  it 'still deletes an assessment that has no sessions' do
    id = assessment.id
    delete "/api/v1/assessments/#{id}", headers: auth_headers(org)

    expect(response).to have_http_status(:ok)
    expect(Assessment.unscoped.exists?(id)).to be(false)
  end

  it 'does not delete another tenant’s assessment' do
    other = create_org(scheme: 'other-company')
    id = assessment.id
    delete "/api/v1/assessments/#{id}", headers: auth_headers(other)

    expect(response).to have_http_status(:not_found)
    expect(Assessment.unscoped.exists?(id)).to be(true)
  end
end
