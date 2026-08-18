# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'CV Screening Entries API', type: :request do
  let(:organization) { create(:organization) }
  let(:screening) { create(:cv_screening, organization: organization) }
  let(:batch) { create(:cv_screening_batch, cv_screening: screening) }
  let(:headers) { auth_headers(user_id: 1, role: 'assessor', scheme: organization.scheme) }

  def entry_with_file
    entry = create(:cv_screening_entry, cv_screening_batch: batch)
    entry.cv_file.attach(
      io: File.open(Rails.root.join('spec/fixtures/files/sample_cv.pdf')),
      filename: 'sample_cv.pdf',
      content_type: 'application/pdf'
    )
    entry
  end

  describe 'GET /api/v1/cv_screenings/:cv_screening_id/entries' do
    it 'lists entries for the screening, filterable by decision' do
      create(:cv_screening_entry, cv_screening_batch: batch, decision: 'needs_review')
      create(:cv_screening_entry, cv_screening_batch: batch, decision: 'pending')

      get "/api/v1/cv_screenings/#{screening.id}/entries", params: { decision: 'needs_review' }, headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body['entries'].size).to eq(1)
      expect(json_body['entries'].first['decision']).to eq('needs_review')
    end
  end

  describe 'POST /api/v1/cv_screening_entries/:id/review' do
    it 'invites the candidate' do
      entry = create(:cv_screening_entry, cv_screening_batch: batch, decision: 'needs_review')

      post "/api/v1/cv_screening_entries/#{entry.id}/review", params: { action: 'invite' }, headers: headers

      expect(response).to have_http_status(:ok)
      expect(entry.reload.decision).to eq('invited')
      expect(entry.decision_reason).to eq('recruiter_invited')
    end

    it 'rejects the candidate' do
      entry = create(:cv_screening_entry, cv_screening_batch: batch, decision: 'needs_review')
      # The controller constructs its own Gemini::HttpClient (no request-level DI
      # seam) to generate CvScreenings::FeedbackGenerator's rejection copy —
      # allow_any_instance_of is the pragmatic stub here, unlike unit specs on the
      # service itself, which inject a double via gemini_client:.
      allow_any_instance_of(Gemini::HttpClient).to receive(:generate_content)
        .and_return({ 'feedback' => 'Thanks for applying.' })

      post "/api/v1/cv_screening_entries/#{entry.id}/review", params: { action: 'reject' }, headers: headers

      expect(entry.reload.decision).to eq('not_advanced')
      expect(entry.decision_reason).to eq('recruiter_rejected')
    end

    it 'rejects an unrecognized action' do
      entry = create(:cv_screening_entry, cv_screening_batch: batch)

      post "/api/v1/cv_screening_entries/#{entry.id}/review", params: { action: 'delete' }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(entry.reload.decision).to eq('pending')
    end
  end

  describe 'GET /api/v1/cv_screening_entries/:id/file' do
    it 'streams the attached file for an authorized recruiter' do
      entry = entry_with_file

      get "/api/v1/cv_screening_entries/#{entry.id}/file", headers: headers

      expect(response).to have_http_status(:ok)
      expect(response.headers['Content-Disposition']).to include('sample_cv.pdf')
    end

    it "a recruiter in org A cannot download org B's entry file" do
      other_org = create(:organization)
      other_screening = create(:cv_screening, organization: other_org)
      other_batch = create(:cv_screening_batch, cv_screening: other_screening)
      other_entry = create(:cv_screening_entry, cv_screening_batch: other_batch)

      get "/api/v1/cv_screening_entries/#{other_entry.id}/file", headers: headers

      expect(response).to have_http_status(:not_found)
    end

    it 'returns 404 when no file is attached yet' do
      entry = create(:cv_screening_entry, cv_screening_batch: batch)

      get "/api/v1/cv_screening_entries/#{entry.id}/file", headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end
end
