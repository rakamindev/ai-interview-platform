# frozen_string_literal: true

require 'rails_helper'

# A session without a portfolio must NOT report "generating" — the candidate
# simply has not interviewed yet. Only a portfolio that is actually pending or
# generating may say so.
RSpec.describe 'Portfolio status semantics', type: :request do
  let!(:org) { create(:organization, scheme: 'test-corp', identifier: 'test-corp', name: 'Test Corp', host: 'localhost') }
  let(:token) { JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: 'test-corp' }) }
  let(:auth) { { 'Authorization' => "Bearer #{token}" } }

  let!(:assessment) { create(:assessment, tenant_id: org.id, name: 'Engineer') }

  it 'returns status none for a session without any portfolio' do
    session = create(:session, tenant_id: org.id, assessment: assessment, status: 'pending')

    get "/api/v1/sessions/#{session.id}/portfolio", headers: auth

    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)).to eq('status' => 'none')
  end

  it 'returns status generating only when a portfolio is actually generating' do
    session = create(:session, tenant_id: org.id, assessment: assessment, status: 'active')
    create(:portfolio, session: session, generation_status: 'generating')

    get "/api/v1/sessions/#{session.id}/portfolio", headers: auth

    expect(response).to have_http_status(:accepted)
    expect(JSON.parse(response.body)).to eq('status' => 'generating')
  end

  describe 'FitGap retrieval semantics' do
    let!(:vacancy) { create(:vacancy, tenant_id: org.id, role_title: 'Tech Lead') }

    it 'returns status generating (202 Accepted) and enqueues generation when fitgap does not exist yet' do
      session = create(:session, tenant_id: org.id, assessment: assessment, status: 'ended')
      portfolio = create(:portfolio, session: session, generation_status: 'complete', tenant_id: org.id)

      expect {
        get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: auth
      }.to change(FitGapGeneratorWorker.jobs, :size).by(1)

      expect(response).to have_http_status(:accepted)
      expect(JSON.parse(response.body)['status']).to eq('generating')
    end

    it 'returns 200 OK with report when fitgap already exists' do
      session = create(:session, tenant_id: org.id, assessment: assessment, status: 'ended')
      portfolio = create(:portfolio, session: session, generation_status: 'complete', tenant_id: org.id)
      create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy, skill_comparisons: [{ 'skill_label' => 'Ruby', 'result' => 'match' }])

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: auth

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)['report']).to be_present
    end
  end
end
