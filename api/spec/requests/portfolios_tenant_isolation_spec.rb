# frozen_string_literal: true

require 'rails_helper'
require 'sidekiq/testing'

# Tes isolasi data antar perusahaan (tenant) pada endpoint portofolio dan fit/gap.
# Penilai dari perusahaan A tidak boleh bisa membaca atau mengubah data milik perusahaan B,
# sedangkan data milik perusahaannya sendiri tetap harus bisa diakses.
RSpec.describe 'Isolasi data antar perusahaan pada portofolio dan fit/gap', type: :request do
  before do
    ENV['SECRET_KEY_BASE'] ||= 'rahasia-khusus-tes'
    Rack::Attack.enabled = false if Rack::Attack.respond_to?(:enabled=)
    FitGapGeneratorWorker.jobs.clear
  end

  let!(:org_a) do
    Organization.create!(name: 'Perusahaan A', scheme: 'perusahaan-a', identifier: 'perusahaan-a', host: 'a.example.test')
  end
  let!(:org_b) do
    Organization.create!(name: 'Perusahaan B', scheme: 'perusahaan-b', identifier: 'perusahaan-b', host: 'b.example.test')
  end

  # Membuat satu set data lengkap milik satu perusahaan.
  def buat_data(org, label)
    assessment = Assessment.unscoped.create!(
      tenant_id: org.id, created_by: 1, name: "Tes #{label}", time_limit_min: 45, language: 'en'
    )
    vacancy = Vacancy.unscoped.create!(tenant_id: org.id, created_by: 1, role_title: "Lowongan #{label}")
    sesi = Session.unscoped.create!(tenant_id: org.id, assessment_id: assessment.id)
    portofolio = Portfolio.create!(session_id: sesi.id, generation_status: 'complete')
    skill = portofolio.portfolio_skills.create!(
      skill_label: "Skill rahasia #{label}", ai_level: 3, ai_confidence: 'high', competency_summary: 'ringkasan'
    )
    laporan = FitGapReport.create!(
      portfolio_id: portofolio.id, vacancy_id: vacancy.id,
      skill_comparisons: [{ 'skill_label' => "Skill rahasia #{label}" }],
      overall_narrative: "Narasi rahasia #{label}"
    )
    { vacancy: vacancy, portofolio: portofolio, skill: skill, laporan: laporan }
  end

  def header_penilai(org)
    token = JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: org.scheme })
    { 'Authorization' => "Bearer #{token}" }
  end

  let!(:data_a) { buat_data(org_a, 'A') }
  let!(:data_b) { buat_data(org_b, 'B') }

  describe 'GET /api/v1/portfolios/:id/export' do
    it 'mengembalikan portofolio milik perusahaan sendiri' do
      get "/api/v1/portfolios/#{data_a[:portofolio].id}/export", params: { format: 'json' },
                                                                    headers: header_penilai(org_a)

      expect(response).to have_http_status(:ok)
      expect(response.body).to include('Skill rahasia A')
    end

    it 'menolak portofolio milik perusahaan lain dan tidak membocorkan isinya' do
      get "/api/v1/portfolios/#{data_b[:portofolio].id}/export", params: { format: 'json' },
                                                                    headers: header_penilai(org_a)

      expect(response).to have_http_status(:not_found)
      expect(response.body).not_to include('Skill rahasia B')
    end
  end

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    it 'mengembalikan laporan fit/gap milik perusahaan sendiri' do
      get "/api/v1/portfolios/#{data_a[:portofolio].id}/fitgap/#{data_a[:vacancy].id}",
          headers: header_penilai(org_a)

      expect(response).to have_http_status(:ok)
      expect(response.body).to include('Narasi rahasia A')
    end

    it 'menolak laporan fit/gap milik perusahaan lain dan tidak membocorkan isinya' do
      get "/api/v1/portfolios/#{data_b[:portofolio].id}/fitgap/#{data_b[:vacancy].id}",
          headers: header_penilai(org_a)

      expect(response).to have_http_status(:not_found)
      expect(response.body).not_to include('Narasi rahasia B')
    end
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    let(:isi_override) { { override: { override_level: 5, assessor_notes: 'catatan' } } }

    it 'mengizinkan penilai mengubah level skill milik perusahaannya sendiri' do
      expect do
        post "/api/v1/portfolio_skills/#{data_a[:skill].id}/override", params: isi_override,
                                                                         headers: header_penilai(org_a), as: :json
      end.to change(AssessorOverride, :count).by(1)

      expect(response).to have_http_status(:created)
    end

    it 'menolak perubahan level skill milik perusahaan lain' do
      expect do
        post "/api/v1/portfolio_skills/#{data_b[:skill].id}/override", params: isi_override,
                                                                         headers: header_penilai(org_a), as: :json
      end.not_to change(AssessorOverride, :count)

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'pembuatan laporan fit/gap atas portofolio perusahaan lain' do
    it 'POST fitgap menolak dan tidak memasukkan job ke antrean' do
      post "/api/v1/portfolios/#{data_b[:portofolio].id}/fitgap",
           params: { fitgap: { vacancy_id: data_a[:vacancy].id } },
           headers: header_penilai(org_a), as: :json

      expect(response).to have_http_status(:not_found)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end

    it 'POST regenerate_fitgap menolak dan tidak memasukkan job ke antrean' do
      post "/api/v1/portfolios/#{data_b[:portofolio].id}/regenerate_fitgap",
           params: { vacancy_id: data_a[:vacancy].id },
           headers: header_penilai(org_a), as: :json

      expect(response).to have_http_status(:not_found)
      expect(FitGapGeneratorWorker.jobs).to be_empty
    end
  end
end
