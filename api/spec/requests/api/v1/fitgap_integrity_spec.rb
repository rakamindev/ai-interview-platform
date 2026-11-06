# frozen_string_literal: true

require 'rails_helper'

# F-06, F-07, F-09: fit-gap shows the required level and where each level comes from,
# survives overrides, and handles duplicate jobs and errors.
RSpec.describe 'Fit-gap integrity', type: :request do
  let(:data)      { create_portfolio_for(test_organization, ai_level: 3) }
  let(:portfolio) { data[:portfolio] }
  let(:skill)     { data[:skill] }
  let(:vacancy)   { create_vacancy_for(test_organization, expected_level: 3) }
  let(:headers)   { auth_headers(role: 'admin', user_id: 7) }
  let(:reason)    { 'Contoh query di jawaban kandidat tidak memakai indeks.' }

  let(:gemini) { instance_double(Gemini::HttpClient) }

  before do
    allow(Gemini::HttpClient).to receive(:new).and_return(gemini)
    allow(gemini).to receive(:generate_content)
      .and_return({ 'culture_narrative' => 'Narasi budaya fiktif.', 'overall_narrative' => 'Narasi umum fiktif.' })
  end

  def generate_report!
    FitGap::Engine.new(portfolio: portfolio.reload, vacancy: vacancy).call
  end

  def override!(level:, text: reason)
    post "/api/v1/portfolio_skills/#{skill.id}/override",
         params: { override: { override_level: level, assessor_notes: text } }, headers: headers, as: :json
  end

  def show_report
    get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers
    json['report']
  end

  describe 'comparison row contract (F-06, F-07)' do
    it 'a row without an override has required_level and is_override false' do
      generate_report!

      row = show_report['skill_comparisons'].first
      expect(row).to include('required_level' => 3, 'candidate_level' => 3, 'ai_level' => 3,
                             'is_override' => false, 'override_reason' => nil)
    end

    it 'a row with an override has the original AI level, the final level and the reason' do
      override!(level: 2)
      generate_report!

      row = show_report['skill_comparisons'].first
      expect(row).to include('required_level' => 3, 'candidate_level' => 2, 'ai_level' => 3,
                             'is_override' => true, 'override_reason' => reason, 'result' => 'gap')
    end

    it 'an old report without the new fields is still readable (required_level from expected_level) and refreshed automatically' do
      legacy = FitGapReport.create!(
        portfolio:, vacancy:, generated_at: 1.day.ago, stale: true,
        skill_comparisons: [{ 'skill_label' => 'Database Design & SQL', 'expected_level' => 3,
                              'candidate_level' => 3, 'result' => 'match', 'delta' => 0 }]
      )

      report = show_report

      expect(report['id']).to eq(legacy.id)
      expect(report['skill_comparisons'].first).to include('required_level' => 3, 'is_override' => false)
      expect(report['stale']).to be(true)
      expect(FitGapGeneratorWorker.jobs.size).to eq(1)
    end
  end

  describe 'an override does not delete the report (F-09)' do
    before { generate_report! }

    it 'keeps the report, marks it stale and queues one regeneration job' do
      report_id = FitGapReport.find_by!(portfolio:, vacancy:).id

      override!(level: 2)

      expect(FitGapReport.exists?(report_id)).to be(true)
      report = show_report
      expect(report['id']).to eq(report_id)
      expect(report['stale']).to be(true)
      expect(FitGapGeneratorWorker.jobs.size).to eq(1)
    end

    it 'regenerate_fitgap does not delete the report' do
      report_id = FitGapReport.find_by!(portfolio:, vacancy:).id

      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", params: { vacancy_id: vacancy.id },
                                                                   headers: headers, as: :json

      expect(response).to have_http_status(:accepted)
      expect(FitGapReport.exists?(report_id)).to be(true)
      expect(FitGapGeneratorWorker.jobs.size).to eq(1)
    end

    it 'two overrides in a row: duplicate jobs regenerate once and the result reflects the last override' do
      override!(level: 2)
      override!(level: 1, text: 'Setelah membaca ulang transkrip, tidak ada contoh nyata.')
      expect(FitGapGeneratorWorker.jobs.size).to eq(2)

      FitGapGeneratorWorker.drain

      expect(gemini).to have_received(:generate_content).twice # 1x laporan awal + 1x regenerasi
      report = show_report
      expect(report['stale']).to be(false)
      expect(report['skill_comparisons'].first).to include('candidate_level' => 1, 'is_override' => true)
      expect(FitGapReport.where(portfolio:, vacancy:).count).to eq(1)
    end
  end

  describe 'regeneration failures' do
    before do
      generate_report!
      override!(level: 2)
    end

    it 'narrative model error: the report is still updated with a fallback narrative' do
      allow(gemini).to receive(:generate_content).and_raise(Gemini::HttpClient::TimeoutError, 'timeout')

      FitGapGeneratorWorker.drain

      report = show_report
      expect(report['stale']).to be(false)
      expect(report['skill_comparisons'].first).to include('candidate_level' => 2, 'is_override' => true)
      expect(report['overall_narrative']).to match(/skill matches/)
    end

    it 'unexpected failure: the old report stays available, stale, with an error message and no personal data' do
      allow_any_instance_of(FitGap::Engine).to receive(:call).and_raise(StandardError, "boom #{reason}")

      expect { FitGapGeneratorWorker.drain }.to raise_error(StandardError)

      report = show_report
      expect(report['skill_comparisons'].first).to include('candidate_level' => 3) # versi lama
      expect(report['stale']).to be(true)
      expect(report['generation_error']).to be_present
      expect(report['generation_error']).not_to include(reason)
    end
  end
end
