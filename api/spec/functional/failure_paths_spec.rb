# frozen_string_literal: true

require 'rails_helper'

# What the assessor and the candidate get when something goes wrong: the model
# times out or answers garbage, the narrative call fails, a request is invalid,
# or a link is wrong. Each journey goes through HTTP and the background jobs.
RSpec.describe 'Failure paths', type: :request do
  let!(:organization) { create(:organization) }
  let!(:assessor)     { create(:user, password: 'correct-horse-battery') }
  let(:headers)       { sign_in_as(assessor, organization) }

  let(:assessment) { create(:assessment, :with_skills, organization:) }
  let(:session)    { create(:session, assessment:) }

  let(:react_only) do
    { 'configured_skills' => [
      { 'skill_id' => 'SK-ENG-001', 'skill_label' => 'React', 'level' => 3, 'confidence' => 'high',
        'evidence' => ['We profiled with React DevTools.'], 'competency_summary' => 'Solid L3.' }
    ] }
  end

  def end_interview
    simulate_interview(session, turns: [['candidate', 'We profiled with React DevTools.']],
                                coverage: { 'React' => ['covered', 3] })
    post "/api/v1/sessions/#{session.id}/end_session", headers:, params: { session: { reason: 'time_ceiling' } }.to_json
    expect(response).to have_http_status(:ok)
  end

  # Sidekiq::Testing doesn't retry, so a journey plays Sidekiq running out of retries itself.
  def give_up_retrying
    PortfolioGeneratorWorker.sidekiq_retries_exhausted_block.call({ 'args' => [session.id], 'retry_count' => 3 },
                                                                   StandardError.new)
  end

  describe 'portfolio generation' do
    it 'marks the portfolio failed once a model timeout outlasts the retries, then recovers on Retry' do
      stub_gemini(portfolio: Gemini::HttpClient::TimeoutError.new('Gemini API timeout after 180s'))
      end_interview

      expect { run_jobs(PortfolioGeneratorWorker) }.to raise_error(Gemini::HttpClient::TimeoutError)
      give_up_retrying

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers
      expect(response).to have_http_status(:ok)
      expect(json.dig('portfolio', 'generation_status')).to eq('failed')
      expect(json['error']).to include('timeout')
      expect(json.dig('portfolio', 'skills')).to be_empty

      stub_gemini(portfolio: react_only)
      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers
      expect(response).to have_http_status(:ok)
      expect(json.dig('portfolio', 'generation_status')).to eq('pending')

      run_jobs(PortfolioGeneratorWorker)

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers
      expect(json.dig('portfolio', 'generation_status')).to eq('complete')
      expect(json.dig('portfolio', 'generation_error')).to be_nil
      expect(json.dig('portfolio', 'skills').pluck('skill_label')).to include('React')
    end

    it 'marks the portfolio failed once the model keeps answering with something that is not JSON' do
      stub_gemini(portfolio: 'Sure! Here is the portfolio you asked for:')
      end_interview

      # Not JSON::ParserError: its message quotes the model's text, and Sidekiq logs every failed job's message.
      expect { run_jobs(PortfolioGeneratorWorker) }.to raise_error(Portfolios::Generator::InvalidResponse)
      give_up_retrying

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers
      expect(json.dig('portfolio', 'generation_status')).to eq('failed')
    end

    it 'P2-26: keeps the portfolio generating while Sidekiq still retries, and queues no second job on Retry' do
      stub_gemini(portfolio: Gemini::HttpClient::ApiError.new('API returned 503', status: 503))
      end_interview

      expect { run_jobs(PortfolioGeneratorWorker) }.to raise_error(Gemini::HttpClient::ApiError)

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers
      expect(response).to have_http_status(:accepted)
      expect(json['status']).to eq('generating')

      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
      expect(PortfolioGeneratorWorker.jobs).to be_empty
    end

    it 'queues one job when Retry is clicked twice' do
      stub_gemini(portfolio: Gemini::HttpClient::ApiError.new('API returned 503', status: 503))
      end_interview
      expect { run_jobs(PortfolioGeneratorWorker) }.to raise_error(Gemini::HttpClient::ApiError)
      give_up_retrying

      2.times { post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers }

      expect(response).to have_http_status(:unprocessable_entity)
      expect(PortfolioGeneratorWorker.jobs.size).to eq(1)
    end

    it 'refuses to regenerate a portfolio that did not fail' do
      stub_gemini(portfolio: react_only)
      end_interview
      run_jobs(PortfolioGeneratorWorker)

      post "/api/v1/sessions/#{session.id}/portfolio/regenerate", headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
      expect(PortfolioGeneratorWorker.jobs).to be_empty
    end
  end

  describe 'fit/gap' do
    it 'still produces a report with a fallback summary when the narrative call fails' do
      stub_gemini(portfolio: react_only, narrative: Gemini::HttpClient::ApiError.new('503 high demand', status: 503))
      end_interview
      run_jobs(PortfolioGeneratorWorker)
      portfolio_id = session.reload.portfolio.id
      vacancy = create(:vacancy, organization:)
      create(:vacancy_skill, vacancy:, skill_id: 'SK-ENG-001', skill_label: 'React', expected_level: 3)

      post "/api/v1/portfolios/#{portfolio_id}/fitgap", headers:, params: { fitgap: { vacancy_id: vacancy.id } }.to_json
      run_jobs(FitGapGeneratorWorker)

      get "/api/v1/portfolios/#{portfolio_id}/fitgap/#{vacancy.id}", headers: headers
      expect(response).to have_http_status(:ok)
      expect(json['report']).to include('culture_narrative' => nil)
      expect(json.dig('report', 'overall_narrative')).to start_with('Candidate shows 1 skill matches')
      expect(json.dig('report', 'skill_comparisons').sole).to include('result' => 'match')
    end

    it 'refuses to compare before the portfolio is ready' do
      stub_gemini(portfolio: react_only)
      end_interview
      vacancy = create(:vacancy, organization:)

      post "/api/v1/portfolios/#{session.reload.portfolio.id}/fitgap", headers:,
                                                                     params: { fitgap: { vacancy_id: vacancy.id } }.to_json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end
  end

  describe 'invalid requests' do
    it 'rejects an assessment with a time limit the product does not offer' do
      post '/api/v1/assessments', headers:, params: { assessment: { name: 'Role', time_limit_min: 15 } }.to_json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(Assessment.count).to eq(0)
    end

    it 'rejects an unknown end reason and does not end the session' do
      post "/api/v1/sessions/#{session.id}/end_session", headers:, params: { session: { reason: 'bored' } }.to_json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(session.reload.status).to eq('pending')
    end

    it 'refuses to end a session twice and queues only one portfolio' do
      2.times do
        post "/api/v1/sessions/#{session.id}/end_session", headers:, params: { session: { reason: 'manual_assessor' } }.to_json
      end

      expect(response).to have_http_status(:unprocessable_entity)
      expect(PortfolioGeneratorWorker.jobs.size).to eq(1)
    end

    it 'answers 404 for an invite link that does not exist' do
      get '/api/v1/sessions/not-a-real-token/candidate'

      expect(response).to have_http_status(:not_found)
    end

    it 'turns away assessor calls without a token' do
      get '/api/v1/assessments', headers: FunctionalHelpers::JSON_HEADERS

      expect(response.status).to be_in([401, 403])
    end
  end
end
