# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'CV Screening Batches API', type: :request do
  let(:organization) { create(:organization) }
  let(:screening) { create(:cv_screening, organization: organization) }
  let(:headers) { auth_headers(user_id: 1, role: 'assessor', scheme: organization.scheme) }
  let(:cv_file) { fixture_file_upload('sample_cv.pdf', 'application/pdf') }

  describe 'POST /api/v1/cv_screenings/:cv_screening_id/batches' do
    it 'creates a batch and one entry per uploaded file, attaching the file' do
      post "/api/v1/cv_screenings/#{screening.id}/batches",
           params:  { files: [cv_file] },
           headers: headers

      expect(response).to have_http_status(:created)
      expect(json_body['entries'].size).to eq(1)
      expect(json_body['entries'].first['decision']).to eq('pending')
      expect(json_body['entries'].first['filename']).to eq('sample_cv.pdf')
    end

    it "snapshots the vacancy's current version and the screening's threshold onto the batch" do
      post "/api/v1/cv_screenings/#{screening.id}/batches",
           params:  { files: [cv_file] },
           headers: headers

      batch = CvScreeningBatch.find(json_body['batch']['id'])
      expect(batch.vacancy_version_id).to eq(screening.vacancy.vacancy_versions.order(created_at: :desc).first.id)
      expect(batch.threshold).to eq(screening.threshold)
    end

    it 'requires at least one file' do
      post "/api/v1/cv_screenings/#{screening.id}/batches", params: {}, headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe 'POST /api/v1/cv_screenings/:cv_screening_id/batches/:id/confirm' do
    it 'releases a held batch and sends its queued notification' do
      batch = create(:cv_screening_batch, cv_screening: screening, notification_status: 'held')
      session = create(:session, assessment: screening.assessment, tenant_id: screening.tenant_id)
      create(:cv_screening_entry, cv_screening_batch: batch, decision: 'invited',
                                   detected_email: 'jordan.example@test.invalid', session: session)

      post "/api/v1/cv_screenings/#{screening.id}/batches/#{batch.id}/confirm", headers: headers

      expect(response).to have_http_status(:ok)
      expect(json_body.dig('batch', 'notification_status')).to eq('released')
      expect(ActionMailer::Base.deliveries.size).to eq(1)
    end

    it 'rejects confirming a batch that is not awaiting confirmation' do
      batch = create(:cv_screening_batch, cv_screening: screening, notification_status: 'pending')

      post "/api/v1/cv_screenings/#{screening.id}/batches/#{batch.id}/confirm", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe 'the upload throttle', :rack_attack do
    # `around` runs its pre-example.run code BEFORE the global `before` in
    # spec/support/rack_attack.rb (which sets enabled = false) even fires — that
    # global hook only executes once `example.run` is called. Plain before/after
    # hooks here are nested (run after the global one), so ordering comes out right.
    before { Rack::Attack.enabled = true }
    after  { Rack::Attack.enabled = false }

    it 'returns 429 after 10 uploads per minute from the same IP' do
      11.times do
        post "/api/v1/cv_screenings/#{screening.id}/batches",
             params:  { files: [cv_file] },
             headers: headers
      end

      expect(response).to have_http_status(:too_many_requests)
    end
  end
end
