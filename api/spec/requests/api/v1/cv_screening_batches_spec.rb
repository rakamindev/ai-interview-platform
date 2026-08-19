# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'CV Screening Batches API', type: :request do
  let(:organization) { create(:organization) }
  let(:screening) { create(:cv_screening, organization: organization) }
  let(:headers) { auth_headers(user_id: 1, role: 'assessor', scheme: organization.scheme) }
  let(:cv_file) { fixture_file_upload('sample_cv.pdf', 'application/pdf') }

  describe 'GET /api/v1/cv_screenings/:cv_screening_id/batches' do
    it 'lists batches for the screening, most recent first, including approximate/notification flags' do
      older = create(:cv_screening_batch, cv_screening: screening, notification_status: 'released')
      newer = create(:cv_screening_batch, cv_screening: screening, notification_status: 'held')

      get "/api/v1/cv_screenings/#{screening.id}/batches", headers: headers

      expect(response).to have_http_status(:ok)
      ids = json_body['batches'].map { |b| b['id'] }
      expect(ids.first(2)).to eq([newer.id, older.id])
      expect(json_body['batches'].first).to include('notification_status' => 'held',
                                                      'vacancy_version_approximate' => false)
    end
  end

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
