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

    it "shows the entry's own batch-snapshotted vacancy/assessment/threshold, not the screening's current ones" do
      create(:cv_screening_entry, cv_screening_batch: batch)
      other_vacancy = create(:vacancy, organization: organization, public_requirement_text: 'Other.')
      other_assessment = create(:assessment, organization: organization)

      # Edit the screening after the batch/entry already exist — same as a
      # recruiter using CvScreeningEditPage post-upload.
      screening.update!(vacancy_id: other_vacancy.id, assessment_id: other_assessment.id, threshold: 50)

      get "/api/v1/cv_screenings/#{screening.id}/entries", headers: headers

      expect(response).to have_http_status(:ok)
      entry_json = json_body['entries'].first
      expect(entry_json['vacancy_role_title']).to eq(batch.vacancy.role_title)
      expect(entry_json['assessment_name']).to eq(batch.assessment.name)
      expect(entry_json['vacancy_role_title']).not_to eq(other_vacancy.role_title)
      expect(entry_json['threshold']).to eq(batch.threshold)
      expect(entry_json['threshold']).not_to eq(50)
    end

    it 'paginates with page/per_page and returns pagination meta' do
      create_list(:cv_screening_entry, 5, cv_screening_batch: batch)

      get "/api/v1/cv_screenings/#{screening.id}/entries", params: { per_page: 2, page: 2 }, headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body['entries'].size).to eq(2)
      expect(json_body['meta']).to include(
        'current_page' => 2,
        'total_pages'  => 3,
        'total_count'  => 5,
        'per_page'     => 2
      )
    end
  end

  describe 'POST /api/v1/cv_screening_entries/:id/review' do
    it 'invites the candidate' do
      entry = create(:cv_screening_entry, cv_screening_batch: batch, decision: 'needs_review',
                                           detected_email: 'jordan.example@test.invalid')

      post "/api/v1/cv_screening_entries/#{entry.id}/review", params: { action: 'invite' }, headers: headers

      expect(response).to have_http_status(:ok)
      expect(entry.reload.decision).to eq('invited')
      expect(entry.decision_reason).to eq('recruiter_invited')
    end

    it 'rejects the candidate' do
      entry = create(:cv_screening_entry, cv_screening_batch: batch, decision: 'needs_review',
                                           detected_email: 'jordan.example@test.invalid')
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

    it 'refuses to review a no-email entry with no email param' do
      entry = create(:cv_screening_entry, cv_screening_batch: batch, decision: 'needs_review', detected_email: nil)

      post "/api/v1/cv_screening_entries/#{entry.id}/review", params: { action: 'invite' }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(entry.reload.decision).to eq('needs_review')
      expect(entry.detected_email).to be_nil
    end

    it 'refuses to review a no-email entry with an invalid-format email' do
      entry = create(:cv_screening_entry, cv_screening_batch: batch, decision: 'needs_review', detected_email: nil)

      post "/api/v1/cv_screening_entries/#{entry.id}/review",
           params: { action: 'invite', email: 'not-an-email' }, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(entry.reload.detected_email).to be_nil
    end

    it 'accepts a submitted email for a no-email entry, persists it, and invites with it' do
      entry = create(:cv_screening_entry, cv_screening_batch: batch, decision: 'needs_review', detected_email: nil)

      post "/api/v1/cv_screening_entries/#{entry.id}/review",
           params: { action: 'invite', email: 'jordan.example@test.invalid' }, headers: headers

      expect(response).to have_http_status(:ok)
      entry.reload
      expect(entry.decision).to eq('invited')
      expect(entry.detected_email).to eq('jordan.example@test.invalid')
      expect(entry.session.candidate_name).to eq('jordan.example@test.invalid')
    end
  end

  describe 'POST /api/v1/cv_screening_entries/:id/reanalyze' do
    it 'resets a model_failed entry to pending and re-enqueues the worker' do
      entry = create(:cv_screening_entry, cv_screening_batch: batch, decision: 'needs_review',
                                           decision_reason: 'model_failed', score: nil)

      expect do
        post "/api/v1/cv_screening_entries/#{entry.id}/reanalyze", headers: headers
      end.to change(CvScreeningProcessEntryWorker.jobs, :size).by(1)

      expect(response).to have_http_status(:ok)
      expect(entry.reload.decision).to eq('pending')
      expect(entry.decision_reason).to be_nil
      expect(CvScreeningProcessEntryWorker.jobs.last['args']).to eq([entry.id])
    end

    it 'refuses to re-analyze an entry that never actually failed to analyze' do
      entry = create(:cv_screening_entry, cv_screening_batch: batch, decision: 'needs_review',
                                           decision_reason: 'below_private_threshold', score: 40)

      post "/api/v1/cv_screening_entries/#{entry.id}/reanalyze", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(entry.reload.decision).to eq('needs_review')
    end

    it 'also re-analyzes an entry that was manually cancelled out of a stuck pending state' do
      entry = create(:cv_screening_entry, cv_screening_batch: batch, decision: 'needs_review',
                                           decision_reason: 'cancelled')

      expect do
        post "/api/v1/cv_screening_entries/#{entry.id}/reanalyze", headers: headers
      end.to change(CvScreeningProcessEntryWorker.jobs, :size).by(1)

      expect(response).to have_http_status(:ok)
      expect(entry.reload.decision).to eq('pending')
    end
  end

  describe 'POST /api/v1/cv_screening_entries/:id/cancel' do
    it 'moves a stuck pending entry to needs_review, never a rejection' do
      entry = create(:cv_screening_entry, cv_screening_batch: batch, decision: 'pending')

      post "/api/v1/cv_screening_entries/#{entry.id}/cancel", headers: headers

      expect(response).to have_http_status(:ok)
      expect(entry.reload.decision).to eq('needs_review')
      expect(entry.decision_reason).to eq('cancelled')
    end

    it 'refuses to cancel an entry that already has a real decision' do
      entry = create(:cv_screening_entry, cv_screening_batch: batch, decision: 'invited',
                                           decision_reason: 'auto_invited')

      post "/api/v1/cv_screening_entries/#{entry.id}/cancel", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(entry.reload.decision).to eq('invited')
    end

    it "unblocks the batch's notification gate for entries already decided alongside the cancelled one" do
      stuck_entry = create(:cv_screening_entry, cv_screening_batch: batch, decision: 'pending')
      create(:cv_screening_entry, cv_screening_batch: batch, decision: 'invited', decision_reason: 'auto_invited')

      expect(batch.notification_status).to eq('pending')

      post "/api/v1/cv_screening_entries/#{stuck_entry.id}/cancel", headers: headers

      expect(batch.reload.notification_status).not_to eq('pending')
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
