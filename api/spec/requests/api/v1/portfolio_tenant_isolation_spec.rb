# frozen_string_literal: true

require 'rails_helper'

# F-02 (P0): portofolio, skill, override, dan fit-gap hanya boleh diakses oleh
# organisasi pemilik sesi. Organisasi lain harus menerima 404 tanpa data apa pun.
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

  describe 'organisasi lain' do
    it 'tidak bisa melihat portofolio lewat sesi' do
      get "/api/v1/sessions/#{session_record.id}/portfolio", headers: intruder_headers
      expect_not_found_without_leak
    end

    it 'tidak bisa meng-export portofolio (JSON)' do
      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }, headers: intruder_headers
      expect_not_found_without_leak
    end

    it 'tidak bisa meng-export portofolio (PDF)' do
      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'pdf' }, headers: intruder_headers
      expect_not_found_without_leak
    end

    it 'tidak bisa meng-override skill dan tidak ada override yang tersimpan' do
      expect do
        post "/api/v1/portfolio_skills/#{skill.id}/override",
             params:  { override: { override_level: 1, assessor_notes: 'Percobaan dari organisasi lain.' } },
             headers: intruder_headers,
             as:      :json
      end.not_to change(AssessorOverride, :count)

      expect_not_found_without_leak
    end

    it 'tidak bisa membaca fit-gap report' do
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{owner_vacancy.id}", headers: intruder_headers
      expect_not_found_without_leak
    end

    it 'tidak bisa memicu fit-gap baru dan tidak ada job yang diantrekan' do
      intruder_vacancy = create_vacancy_for(other_organization)

      post "/api/v1/portfolios/#{portfolio.id}/fitgap",
           params: { fitgap: { vacancy_id: intruder_vacancy.id } }, headers: intruder_headers, as: :json

      expect_not_found_without_leak
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it 'tidak bisa meregenerasi fit-gap memakai lowongan pemilik, dan report pemilik tidak terhapus' do
      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap",
           params: { vacancy_id: owner_vacancy.id }, headers: intruder_headers, as: :json

      expect(response).to have_http_status(:not_found)
      expect(FitGapReport.exists?(owner_report.id)).to be(true)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it 'tidak bisa meregenerasi fit-gap memakai lowongannya sendiri' do
      intruder_vacancy = create_vacancy_for(other_organization)

      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap",
           params: { vacancy_id: intruder_vacancy.id }, headers: intruder_headers, as: :json

      expect_not_found_without_leak
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end
  end

  describe 'organisasi pemilik' do
    it 'bisa meng-export portofolionya' do
      get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'json' }, headers: owner_headers

      expect(response).to have_http_status(:ok)
      expect(response.body).to include('Kutipan fiktif')
    end

    it 'bisa membaca fit-gap report miliknya' do
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{owner_vacancy.id}", headers: owner_headers

      expect(response).to have_http_status(:ok)
      expect(json.dig('report', 'id')).to eq(owner_report.id)
    end

    it 'bisa meng-override skill miliknya' do
      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params:  { override: { override_level: 2, assessor_notes: 'Bukti desain indeks masih dangkal.' } },
           headers: owner_headers,
           as:      :json

      expect(response).to have_http_status(:created)
      expect(AssessorOverride.where(portfolio_skill_id: skill.id).count).to eq(1)
    end
  end
end
