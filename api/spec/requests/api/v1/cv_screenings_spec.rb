# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'CV Screenings API', type: :request do
  let(:organization) { create(:organization) }
  let(:vacancy) { create(:vacancy, organization: organization, public_requirement_text: 'Must know Ruby.') }
  let(:assessment) { create(:assessment, organization: organization) }
  let(:headers) { auth_headers(user_id: 1, role: 'assessor', scheme: organization.scheme) }

  describe 'POST /api/v1/cv_screenings' do
    it 'creates a screening' do
      post '/api/v1/cv_screenings',
           params:  { cv_screening: { name: 'Backend Hiring', vacancy_id: vacancy.id, assessment_id: assessment.id,
                                       threshold: 70 } },
           headers: headers

      expect(response).to have_http_status(:created)
      expect(json_body.dig('cv_screening', 'name')).to eq('Backend Hiring')
    end

    it 'is blocked when the selected vacancy has no public_requirement_text' do
      bare_vacancy = create(:vacancy, organization: organization, public_requirement_text: nil)

      post '/api/v1/cv_screenings',
           params:  { cv_screening: { name: 'X', vacancy_id: bare_vacancy.id, assessment_id: assessment.id } },
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json_body['errors'].first['message']).to match(/public requirement text/)
    end
  end

  describe 'GET /api/v1/cv_screenings/:id' do
    it 'returns the screening with entry-decision summary counts' do
      screening = create(:cv_screening, tenant_id: organization.id, vacancy: vacancy, assessment: assessment)
      batch = create(:cv_screening_batch, cv_screening: screening)
      create(:cv_screening_entry, cv_screening_batch: batch)

      get "/api/v1/cv_screenings/#{screening.id}", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body.dig('cv_screening', 'summary', 'total')).to eq(1)
      expect(json_body.dig('cv_screening', 'summary', 'pending')).to eq(1)
    end
  end

  describe 'tenant isolation' do
    it "a recruiter in org A cannot view org B's screening" do
      other_org = create(:organization)
      other_vacancy = create(:vacancy, organization: other_org, public_requirement_text: 'Something.')
      other_assessment = create(:assessment, organization: other_org)
      other_screening = create(:cv_screening, tenant_id: other_org.id, vacancy: other_vacancy,
                                                assessment: other_assessment)

      get "/api/v1/cv_screenings/#{other_screening.id}", headers: headers

      expect(response).to have_http_status(:not_found)
    end

    it "a recruiter in org A cannot screen org B's vacancy" do
      other_org = create(:organization)
      other_vacancy = create(:vacancy, organization: other_org, public_requirement_text: 'Something.')

      post '/api/v1/cv_screenings',
           params:  { cv_screening: { name: 'X', vacancy_id: other_vacancy.id, assessment_id: assessment.id } },
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
