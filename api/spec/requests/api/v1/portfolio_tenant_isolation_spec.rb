# frozen_string_literal: true

require 'rails_helper'

# F-02 (P0): portfolios, skills, overrides and fit-gap reports are only reachable
# by the owning organisation. Others get a 404 with no data.
RSpec.describe 'Portfolio tenant isolation', type: :request do
  let!(:owner_data)    { create_portfolio_for(test_organization) }
  let!(:owner_vacancy) { create_vacancy_for(test_organization) }
  let(:portfolio)      { owner_data[:portfolio] }
  let(:skill)          { owner_data[:skill] }
  let(:session_record) { owner_data[:session] }

  let(:owner_headers)    { auth_headers(role: 'admin', user_id: 1) }
  let(:intruder_headers) { auth_headers(role: 'admin', user_id: 99, scheme: other_organization.scheme) }

  let!(:owner_report) do
    FitGapReport.create!(
      portfolio:         portfolio,
      vacancy:           owner_vacancy,
      skill_comparisons: [{ skill_label: 'Database Design & SQL', expected_level: 3, candidate_level: 3, result: 'match', delta: 0 }],
      overall_narrative: 'Narasi fiktif.',
      generated_at:      Time.current
    )
  end

  def expect_not_found_without_leak
    expect(response).to have_http_status(:not_found)
    expect(response.body).not_to include('Kutipan fiktif')
    expect(response.body).not_to include('Ringkasan fiktif')
    expect(response.body).not_to include('Narasi fiktif')
  end

  describe 'another organisation' do
    it 'cannot view the portfolio through the session' do
      get "/api/v1/sessions/#{session_record.id}/portfolio", headers: intruder_headers
      expect_not_found_without_leak
    end

    it 'cannot export the portfolio (JSON)' do
      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }, headers: intruder_headers
      expect_not_found_without_leak
    end

    it 'cannot export the portfolio (PDF)' do
      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'pdf' }, headers: intruder_headers
      expect_not_found_without_leak
    end

    it 'cannot override a skill and nothing is saved' do
      expect do
        post "/api/v1/portfolio_skills/#{skill.id}/override",
             params:  { override: { override_level: 1, assessor_notes: 'Percobaan dari organisasi lain.' } },
             headers: intruder_headers,
             as:      :json
      end.not_to change(AssessorOverride, :count)

      expect_not_found_without_leak
    end

    it 'cannot read the fit-gap report' do
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{owner_vacancy.id}", headers: intruder_headers
      expect_not_found_without_leak
    end

    it 'cannot trigger a new fit-gap and no job is queued' do
      intruder_vacancy = create_vacancy_for(other_organization)

      post "/api/v1/portfolios/#{portfolio.id}/fitgap",
           params: { fitgap: { vacancy_id: intruder_vacancy.id } }, headers: intruder_headers, as: :json

      expect_not_found_without_leak
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it "cannot regenerate fit-gap with the owner's vacancy, and the owner's report is kept" do
      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap",
           params: { vacancy_id: owner_vacancy.id }, headers: intruder_headers, as: :json

      expect(response).to have_http_status(:not_found)
      expect(FitGapReport.exists?(owner_report.id)).to be(true)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it 'cannot regenerate fit-gap with its own vacancy' do
      intruder_vacancy = create_vacancy_for(other_organization)

      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap",
           params: { vacancy_id: intruder_vacancy.id }, headers: intruder_headers, as: :json

      expect_not_found_without_leak
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end
  end

  describe 'owning organisation' do
    it 'can export its portfolio' do
      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }, headers: owner_headers

      expect(response).to have_http_status(:ok)
      expect(response.body).to include('Kutipan fiktif')
    end

    it 'can read its fit-gap report' do
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{owner_vacancy.id}", headers: owner_headers

      expect(response).to have_http_status(:ok)
      expect(json.dig('report', 'id')).to eq(owner_report.id)
    end

    it 'can override its skill' do
      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params:  { override: { override_level: 2, assessor_notes: 'Bukti desain indeks masih dangkal.' } },
           headers: owner_headers,
           as:      :json

      expect(response).to have_http_status(:created)
      expect(AssessorOverride.where(portfolio_skill_id: skill.id).count).to eq(1)
    end
  end
end
