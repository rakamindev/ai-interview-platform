# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Portfolios', type: :request do
  let(:organization) do
    Organization.find_or_create_by!(id: 1) do |o|
      o.name = 'Acme Corp'
      o.scheme = 'acme'
      o.identifier = 'acme'
      o.host = 'acme.example.com'
    end
  end

  let(:assessment) do
    Assessment.create!(
      tenant_id: organization.id,
      created_by: 1,
      name: 'Fullstack Dev Assessment',
      time_limit_min: 30,
      language: 'en'
    )
  end

  let(:session) do
    Session.create!(
      tenant_id: organization.id,
      assessment: assessment,
      candidate_id: 101,
      candidate_name: 'John Doe',
      invite_token: 'valid_session_token_123',
      status: 'ended'
    )
  end

  let(:valid_headers) do
    token = JsonWebToken.encode({ user_id: 1, role: 'assessor', scheme: organization.scheme })
    { 'Authorization' => "Bearer #{token}", 'Content-Type' => 'application/json' }
  end

  describe 'GET /api/v1/sessions/:id/portfolio' do
    context 'when session ended and transcript is empty with no portfolio record yet' do
      it 'automatically creates portfolio with empty_transcript status and returns error' do
        get "/api/v1/sessions/#{session.id}/portfolio", headers: valid_headers

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json['error']).to include('Transkrip interview kosong')
        expect(json['portfolio']).to be_present
        expect(json['portfolio']['context_status']).to eq('empty_transcript')
        expect(json['portfolio']['generation_status']).to eq('failed')
        expect(json['portfolio']['context_notes']).to include('rekaman percakapan atau transkrip kosong')
      end
    end

    context 'when portfolio has completed with out_of_context status' do
      let!(:portfolio) do
        session.create_portfolio!(
          candidate_id: session.candidate_id,
          generation_status: 'complete',
          context_status: 'out_of_context',
          context_notes: 'Jawaban kandidat tidak berkaitan dengan topik asesmen.'
        )
      end

      it 'returns portfolio with out_of_context context_status and context_notes' do
        get "/api/v1/sessions/#{session.id}/portfolio", headers: valid_headers

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json['portfolio']['context_status']).to eq('out_of_context')
        expect(json['portfolio']['context_notes']).to eq('Jawaban kandidat tidak berkaitan dengan topik asesmen.')
      end
    end

    context 'when portfolio is generating' do
      let!(:portfolio) do
        session.create_portfolio!(
          candidate_id: session.candidate_id,
          generation_status: 'generating'
        )
      end

      it 'returns 202 accepted with generating status' do
        get "/api/v1/sessions/#{session.id}/portfolio", headers: valid_headers

        expect(response).to have_http_status(:accepted)
        json = JSON.parse(response.body)
        expect(json['status']).to eq('generating')
      end
    end
  end

  describe 'POST /api/v1/sessions/:id/portfolio/regenerate' do
    context 'when transcript is empty' do
      let!(:portfolio) do
        session.create_portfolio!(
          candidate_id: session.candidate_id,
          generation_status: 'failed',
          context_status: 'empty_transcript',
          generation_error: 'Transkrip interview kosong.'
        )
      end

      it 'rejects regeneration with 422 error' do
        post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: valid_headers

        expect(response).to have_http_status(:unprocessable_entity)
        json = JSON.parse(response.body)
        error_msg = json['errors'] ? json['errors'][0]['message'] : json['error']
        expect(error_msg).to include('transcript is empty')
      end
    end

    context 'when transcript has candidate answers and status is failed' do
      let!(:portfolio) do
        session.create_portfolio!(
          candidate_id: session.candidate_id,
          generation_status: 'failed',
          generation_error: 'Temporary error'
        )
      end

      before do
        session.transcript_turns.create!(
          speaker: 'candidate',
          text: 'Saya sudah terbiasa dengan backend Rails dan Postgres.',
          turn_number: 1
        )
      end

      it 'queues generation worker and updates status to pending' do
        expect(PortfolioGeneratorWorker).to receive(:perform_async).with(session.id)

        post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: valid_headers

        expect(response).to have_http_status(:ok)
        json = JSON.parse(response.body)
        expect(json['message']).to eq('Portfolio generation queued')
        expect(portfolio.reload.generation_status).to eq('pending')
      end
    end
  end
end
