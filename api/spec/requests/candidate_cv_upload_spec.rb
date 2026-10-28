# frozen_string_literal: true

require 'rails_helper'
require 'prawn'

# The candidate-facing CV endpoints are reached from an invite link. Every example
# posts with NO Authorization header and NO X-Tenant-Scheme: the invite token is
# the credential. That is the point of these specs — when `upload_cv` was left
# behind the assessor JWT filter and the tenant filter it answered 403 (tenant not
# resolved) and then 401 (missing token), and the browser bounced the candidate to
# the login screen mid-interview.
RSpec.describe 'Candidate CV upload', type: :request do
  let(:organization) do
    Organization.create!(
      name:       'CV Upload Tenant',
      scheme:     "cv-#{SecureRandom.hex(4)}",
      identifier: "cv-#{SecureRandom.hex(4)}",
      host:       "cv-#{SecureRandom.hex(4)}.test"
    )
  end

  let(:assessment) do
    Assessment.create!(
      tenant_id:      organization.id,
      created_by:     1,
      name:           'Backend engineer',
      time_limit_min: 45
    )
  end

  let(:session) do
    Session.create!(
      assessment:     assessment,
      tenant_id:      organization.id,
      candidate_name: 'Jane Doe'
    )
  end

  let(:ended_session) do
    Session.create!(
      assessment: assessment,
      tenant_id:  organization.id,
      status:     'ended',
      ended_at:   Time.current
    )
  end

  let(:cv_text) do
    "JANE DOE\nSenior Backend Engineer\nKafka, PostgreSQL, Redis and Ruby.\n"
  end

  def uploaded_file(body, filename, content_type)
    file = Tempfile.new([File.basename(filename, '.*'), File.extname(filename)])
    file.binmode
    file.write(body)
    file.rewind
    Rack::Test::UploadedFile.new(file.path, content_type, original_filename: filename)
  end

  def post_cv(token, file: nil)
    params = file ? { cv: file } : {}
    post "/api/v1/sessions/#{token}/cv", params: params
  end

  describe 'POST /api/v1/sessions/:token/cv' do
    it 'accepts a plain-text CV without a JWT or a tenant header' do
      post_cv(session.invite_token, file: uploaded_file(cv_text, 'jane_cv.txt', 'text/plain'))

      expect(response).to have_http_status(:ok)

      body = response.parsed_body
      expect(body['success']).to be(true)
      expect(body['text_extracted']).to be(true)
      expect(body['text_length']).to be_positive
      expect(body['preview']).to include('JANE DOE')

      session.reload
      expect(session.cv).to be_attached
      expect(session.cv.filename.to_s).to eq('jane_cv.txt')
      expect(session.cv_text).to include('Kafka')
    end

    it 'extracts text from a real PDF' do
      pdf_body = Prawn::Document.new { text 'RAFI PRATAMA - Staff Engineer. Go, gRPC, Kubernetes.' }.render

      post_cv(session.invite_token, file: uploaded_file(pdf_body, 'rafi_cv.pdf', 'application/pdf'))

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['text_extracted']).to be(true)

      session.reload
      expect(session.cv).to be_attached
      expect(session.cv_text).to include('RAFI PRATAMA')
      expect(session.cv_text).to include('Kubernetes')
    end

    it 'replaces the previous CV so a session keeps exactly one attachment' do
      post_cv(session.invite_token, file: uploaded_file(cv_text, 'first.txt', 'text/plain'))
      expect(response).to have_http_status(:ok)

      post_cv(session.invite_token, file: uploaded_file('SECOND VERSION', 'second.txt', 'text/plain'))
      expect(response).to have_http_status(:ok)

      session.reload
      expect(session.cv.filename.to_s).to eq('second.txt')
      expect(session.cv_text).to include('SECOND VERSION')
      expect(ActiveStorage::Attachment.where(record_type: 'Session', record_id: session.id, name: 'cv').count).to eq(1)
    end

    it 'rejects an unsupported file extension' do
      post_cv(session.invite_token, file: uploaded_file('not a cv', 'notes.docx', 'application/msword'))

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body['errors'].first['message']).to eq('Only PDF and TXT files are supported.')
      expect(session.reload.cv).not_to be_attached
    end

    it 'rejects a file above the 5MB limit' do
      oversized = 'a' * (5.megabytes + 1)
      post_cv(session.invite_token, file: uploaded_file(oversized, 'big.pdf', 'application/pdf'))

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body['errors'].first['message']).to include('too large')
    end

    it 'rejects a request with no file part' do
      post_cv(session.invite_token)

      expect(response).to have_http_status(:bad_request)
      expect(response.parsed_body['errors'].first['message']).to include('CV file is required')
    end

    it 'returns 404 for an unknown invite token' do
      post_cv('not-a-real-token', file: uploaded_file(cv_text, 'jane_cv.txt', 'text/plain'))

      expect(response).to have_http_status(:not_found)
    end

    it 'refuses an upload to a session that has already ended' do
      post_cv(ended_session.invite_token, file: uploaded_file(cv_text, 'jane_cv.txt', 'text/plain'))

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body['errors'].first['message']).to include('already ended')
      expect(ended_session.reload.cv).not_to be_attached
    end
  end

  describe 'GET /api/v1/sessions/:token/candidate' do
    it 'reports the uploaded CV back to the candidate' do
      post_cv(session.invite_token, file: uploaded_file(cv_text, 'jane_cv.txt', 'text/plain'))
      expect(response).to have_http_status(:ok)

      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body['has_cv']).to be(true)
      expect(body['has_cv_text']).to be(true)
      expect(body['cv_filename']).to eq('jane_cv.txt')
    end

    it 'reports no CV before one is uploaded' do
      get "/api/v1/sessions/#{session.invite_token}/candidate"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body['has_cv']).to be(false)
      expect(response.parsed_body['cv_filename']).to be_nil
    end
  end

  describe 'interview prompt wiring' do
    it 'injects the extracted CV into the interviewer instructions' do
      post_cv(session.invite_token, file: uploaded_file(cv_text, 'jane_cv.txt', 'text/plain'))
      expect(response).to have_http_status(:ok)

      instructions = Sessions::StartHandler.compile_cv_instruction(session.reload)

      expect(instructions).to include('CANDIDATE CV & BACKGROUND DOSSIER')
      expect(instructions).to include('Kafka, PostgreSQL, Redis and Ruby.')
    end
  end
end
