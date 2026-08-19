# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Assessments API', type: :request do
  let(:organization) { create(:organization) }
  let(:assessment) { create(:assessment, organization: organization) }
  let(:headers) { auth_headers(user_id: 1, role: 'assessor', scheme: organization.scheme) }

  describe 'GET /api/v1/assessments/:id/deletion_check' do
    it 'is deletable when nothing references it' do
      assessment

      get "/api/v1/assessments/#{assessment.id}/deletion_check", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body['deletable']).to eq(true)
    end

    it 'is not deletable when a CV screening references it, and names the blocker' do
      screening = create(:cv_screening, assessment: assessment, organization: organization)

      get "/api/v1/assessments/#{assessment.id}/deletion_check", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body['deletable']).to eq(false)
      expect(json_body['reason']).to eq('cv_screenings')
      expect(json_body['blocking_cv_screenings']).to contain_exactly(
        { 'id' => screening.id, 'name' => screening.name }
      )
    end

    it 'is not deletable when it has existing candidate sessions' do
      create(:session, assessment: assessment)

      get "/api/v1/assessments/#{assessment.id}/deletion_check", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body['deletable']).to eq(false)
      expect(json_body['reason']).to eq('sessions')
    end
  end

  describe 'DELETE /api/v1/assessments/:id' do
    it 'deletes the assessment and cascades its versions' do
      assessment
      expect(AssessmentVersion.where(assessment_id: assessment.id).count).to be >= 1

      delete "/api/v1/assessments/#{assessment.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(Assessment.find_by(id: assessment.id)).to be_nil
      expect(AssessmentVersion.where(assessment_id: assessment.id)).to be_empty
    end

    it 'refuses to delete an assessment used by a CV screening, and leaves it untouched' do
      screening = create(:cv_screening, assessment: assessment, organization: organization)

      delete "/api/v1/assessments/#{assessment.id}", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(Assessment.find(assessment.id)).to eq(assessment)
      expect(json_body['errors'].first['detail']['blocking_cv_screenings']).to contain_exactly(
        { 'id' => screening.id, 'name' => screening.name }
      )
    end

    it 'refuses to delete an assessment with existing candidate sessions' do
      create(:session, assessment: assessment)

      delete "/api/v1/assessments/#{assessment.id}", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(Assessment.find(assessment.id)).to eq(assessment)
      expect(json_body['errors'].first['detail']['reason']).to eq('sessions')
    end
  end
end
