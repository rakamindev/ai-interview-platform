# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolios API' do
  describe 'GET /api/v1/sessions/:id/portfolio' do
    let(:organization)      { create(:organization) }
    let(:interview_session) { create(:session, assessment: create(:assessment, organization: organization)) }
    let!(:portfolio)        { create(:portfolio, session: interview_session) }

    before { create(:portfolio_skill, portfolio: portfolio, skill_label: 'Ruby on Rails', ai_level: 3) }

    it 'returns the portfolio of a session that belongs to the caller tenant' do
      get "/api/v1/sessions/#{interview_session.id}/portfolio", headers: auth_headers_for(organization)

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.dig('portfolio', 'id')).to eq(portfolio.id)
      expect(response.parsed_body.dig('portfolio', 'skills').pluck('skill_label')).to eq(['Ruby on Rails'])
    end

    it 'describes a not-assessed skill explicitly instead of giving it a level' do
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'System Design', ai_level: nil, ai_confidence: nil,
                               rating_status: 'not_assessed', not_assessed_reason: 'not_covered', evidence: [])

      get "/api/v1/sessions/#{interview_session.id}/portfolio", headers: auth_headers_for(organization)

      skill = response.parsed_body.dig('portfolio', 'skills').find { |s| s['skill_label'] == 'System Design' }
      expect(skill).to include('rating_status' => 'not_assessed', 'not_assessed_reason' => 'not_covered',
                               'ai_level' => nil, 'ai_confidence' => nil)
    end

    it 'exposes an error code and a safe message for a failed portfolio, never the raw error (AC-80)' do
      portfolio.update!(generation_status: 'failed', generation_error_code: 'provider_denied',
                        generation_error: 'Gemini::HttpClient::ApiError: API returned 403: Kandidat Contoh Rahasia')

      get "/api/v1/sessions/#{interview_session.id}/portfolio", headers: auth_headers_for(organization)

      expect(response.body).not_to include('Kandidat Contoh Rahasia')
      expect(response.body).not_to include('ApiError')
      expect(response.parsed_body).not_to have_key('error')
      expect(response.parsed_body['portfolio']).not_to have_key('generation_error')
      expect(response.parsed_body['portfolio']).to include('generation_error_code' => 'provider_denied',
                                                           'generation_error_message' => be_present)
    end

    it 'keeps the original text of symbols and emoji; only the PDF transliterates them' do
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'API Design', evidence: ['Pengalaman ≥ 5 tahun 😀'])

      get "/api/v1/sessions/#{interview_session.id}/portfolio", headers: auth_headers_for(organization)

      skill = response.parsed_body.dig('portfolio', 'skills').find { |s| s['skill_label'] == 'API Design' }
      expect(skill['evidence']).to eq(['Pengalaman ≥ 5 tahun 😀'])
    end

    it 'tells the client whether ratings were validated (legacy portfolios, AC-14)' do
      portfolio.update!(ratings_validated: false)

      get "/api/v1/sessions/#{interview_session.id}/portfolio", headers: auth_headers_for(organization)

      expect(response.parsed_body.dig('portfolio', 'ratings_validated')).to be(false)
    end
  end

  # The PDF is the official decision document (Q4): it must export for every
  # reviewed or unfinished state instead of failing.
  describe 'GET /api/v1/portfolios/:id/export?format=pdf' do
    let(:organization)      { create(:organization) }
    let(:interview_session) { create(:session, assessment: create(:assessment, organization: organization)) }
    let(:portfolio)         { create(:portfolio, session: interview_session, ratings_validated: true) }
    let(:vacancy)           { create(:vacancy, organization: organization) }
    let!(:skill) do
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'SQL & Data Modeling', ai_level: 2,
                               ai_confidence: 'medium')
    end

    before { create(:vacancy_skill, vacancy: vacancy, skill_label: 'SQL & Data Modeling', expected_level: 3) }

    def request_pdf
      get "/api/v1/portfolios/#{portfolio.id}/export?format=pdf&vacancy_id=#{vacancy.id}",
          headers: auth_headers_for(organization)
    end

    def export_pdf
      request_pdf
      PDF::Reader.new(StringIO.new(response.body)).pages.map(&:text).join("\n").gsub(/\s+/, ' ')
    end

    it 'exports a portfolio with an assessor override (was a 500)' do
      PortfolioSkills::OverrideActions.new(skill, actor_id: 7).set(level: 3, notes: 'Contoh: tugas tertulis kuat.')

      text = export_pdf

      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq('application/pdf')
      expect(text).to include('Assessor override', 'Contoh: tugas tertulis kuat.', 'Result: Match')
    end

    it 'exports with an honest status when the AI narrative failed' do
      create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy, status: 'failed', error_code: 'timeout',
                              skill_comparisons: [], overall_narrative: nil)

      text = export_pdf

      expect(response).to have_http_status(:ok)
      expect(text).to include('AI narrative: Failed')
    end

    it 'refuses a portfolio that is not complete with a JSON error (AC-74)' do
      portfolio.update!(generation_status: 'generating')

      request_pdf

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body.dig('errors', 0, 'message')).to be_present
    end

    it 'answers a rendering failure with a safe JSON error and logs only the error class (AC-74)' do
      allow(Exports::PdfGenerator).to receive(:new).and_raise(Prawn::Errors::CannotFit, 'Kandidat Contoh Rahasia')
      allow(Rails.logger).to receive(:error)

      request_pdf

      expect(response).to have_http_status(:internal_server_error)
      expect(response.parsed_body.dig('errors', 0)).to include('code' => 'pdf_render_failed', 'message' => be_present)
      expect(response.body).not_to include('Kandidat Contoh Rahasia')
      expect(Rails.logger).to have_received(:error)
        .with(satisfy { |line| line.include?('Prawn::Errors::CannotFit') && !line.include?('Kandidat Contoh Rahasia') })
    end
  end
end
