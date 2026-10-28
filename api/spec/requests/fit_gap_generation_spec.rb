# frozen_string_literal: true

require 'rails_helper'

# AC7.2 and F7: at most one fit/gap generation per (portfolio, vacancy) at a time, however many
# tabs or users ask, and the existing report stays readable while it is refreshed.
RSpec.describe 'Fit/gap generation', type: :request do
  let(:org) { create(:organization) }
  let(:headers) { auth_headers_for(org) }
  let(:portfolio) { create(:portfolio, organization: org) }
  let(:vacancy) { create(:vacancy, organization: org) }

  def trigger
    post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { fitgap: { vacancy_id: vacancy.id } },
                                                      headers: headers, as: :json
  end

  def show
    get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers
  end

  def json
    JSON.parse(response.body)
  end

  it 'enqueues one job for two requests in a row (two tabs)' do
    trigger
    trigger

    expect(response).to have_http_status(:accepted)
    expect(json['message']).to eq('Fit/gap report is already being generated')
    expect(FitGapGeneratorWorker.jobs.size).to eq(1)
  end

  it 'answers 202 while generating and 404 when nothing was ever requested' do
    show
    expect(response).to have_http_status(:not_found)

    trigger
    show
    expect(response).to have_http_status(:accepted)
    expect(json['status']).to eq('generating')
  end

  it 'keeps serving the existing report during a regeneration, flagged as generating' do
    report = create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy)

    2.times do
      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", params: { vacancy_id: vacancy.id },
                                                                   headers: headers, as: :json
    end
    show

    expect(response).to have_http_status(:ok)
    expect(json.dig('report', 'id')).to eq(report.id)
    expect(json.dig('report', 'generating')).to be(true)
    expect(FitGapGeneratorWorker.jobs.size).to eq(1)
  end

  it 'passes the lock token to the job, so only that job can release it' do
    trigger

    expect(FitGapGeneratorWorker.jobs.first['args']).to match([portfolio.id, vacancy.id, a_string_matching(/\A\h{8}-/)])
  end

  it 'refreshes after an override without freeing the lock of a run in progress' do
    create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy)
    trigger_token = FitGap::GenerationLock.acquire(portfolio.id, vacancy.id)
    skill = create(:portfolio_skill, portfolio: portfolio)

    post "/api/v1/portfolio_skills/#{skill.id}/override", params: { override: { override_level: 4 } },
                                                          headers: headers, as: :json
    allow(FitGap::Engine).to receive(:new).and_return(instance_double(FitGap::Engine, call: nil))
    FitGapGeneratorWorker.drain

    expect(trigger_token).to be_present
    expect(FitGap::GenerationLock.held?(portfolio.id, vacancy.id)).to be(true)
  end

  it 'allows a new run once the worker has finished' do
    trigger
    allow(FitGap::Engine).to receive(:new).and_return(instance_double(FitGap::Engine, call: nil))
    FitGapGeneratorWorker.drain

    trigger
    expect(FitGapGeneratorWorker.jobs.size).to eq(1)
  end
end
