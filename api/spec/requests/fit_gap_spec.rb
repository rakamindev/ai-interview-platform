# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Fit/gap endpoints', type: :request do
  let(:org)       { create(:organization) }
  let(:headers)   { auth_headers(org) }
  let(:session)   { create(:session, assessment: create(:assessment, organization: org)) }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:vacancy)   { create(:vacancy, organization: org) }

  it 'queues one job even when the report is requested repeatedly' do
    3.times do
      post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }, headers: headers
      expect(response).to have_http_status(:accepted)
    end

    expect(FitGapGeneratorWorker.jobs.size).to eq(1)
  end

  it 'allows a new job once the previous one has finished' do
    post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }, headers: headers
    allow(FitGap::Engine).to receive(:new).and_return(instance_double(FitGap::Engine, call: nil))
    FitGapGeneratorWorker.drain

    post "/api/v1/portfolios/#{portfolio.id}/fitgap", params: { vacancy_id: vacancy.id }, headers: headers

    expect(FitGapGeneratorWorker.jobs.size).to eq(1)
  end
end
