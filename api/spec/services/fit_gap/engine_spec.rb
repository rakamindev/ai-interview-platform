# frozen_string_literal: true

require 'rails_helper'

# Tes untuk FitGap::Engine: perbandingan level skill kandidat dengan lowongan.
RSpec.describe FitGap::Engine do
  # Klien Gemini palsu yang selalu gagal, supaya tes tidak memanggil layanan asli.
  let(:gemini_gagal) do
    Class.new do
      def generate_content(*)
        raise 'Gemini sengaja dimatikan untuk tes'
      end
    end.new
  end

  let(:tenant_id) { 1 }

  let(:assessment) do
    Assessment.unscoped.create!(tenant_id: tenant_id, created_by: 1, name: 'Tes', time_limit_min: 45, language: 'en')
  end
  let(:vacancy) do
    Vacancy.unscoped.create!(tenant_id: tenant_id, created_by: 1, role_title: 'Backend Engineer')
  end
  let(:session_record) { Session.unscoped.create!(tenant_id: tenant_id, assessment_id: assessment.id) }
  let(:portfolio) { Portfolio.create!(session_id: session_record.id, generation_status: 'complete') }

  def tambah_skill_lowongan(label, level)
    vacancy.vacancy_skills.create!(skill_label: label, expected_level: level)
  end

  def tambah_skill_portofolio(label, level, confidence: 'high')
    portfolio.portfolio_skills.create!(
      skill_label: label, ai_level: level, ai_confidence: confidence, competency_summary: 'ringkasan'
    )
  end

  def jalankan
    described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini_gagal).call
  end

  def baris(report, label)
    report.skill_comparisons.find { |c| c['skill_label'] == label }
  end

  describe 'hasil perbandingan per skill' do
    before do
      tambah_skill_lowongan('Skill A', 3)
      tambah_skill_lowongan('Skill B', 4)
      tambah_skill_lowongan('Skill C', 2)
      tambah_skill_lowongan('Skill D', 2)
      tambah_skill_portofolio('Skill A', 3)
      tambah_skill_portofolio('Skill B', 1, confidence: 'low')
      tambah_skill_portofolio('Skill C', 5)
      # Skill D sengaja tidak ada di portofolio
    end

    it 'menandai match, gap, exceed, dan not_assessed dengan selisih yang benar' do
      report = jalankan

      expect(baris(report, 'Skill A')).to include('result' => 'match', 'delta' => 0)
      expect(baris(report, 'Skill B')).to include('result' => 'gap', 'delta' => -3, 'confidence' => 'low')
      expect(baris(report, 'Skill C')).to include('result' => 'exceed', 'delta' => 3)
      expect(baris(report, 'Skill D')).to include('result' => 'not_assessed', 'delta' => nil, 'candidate_level' => nil)
    end

    it 'mengirim level yang diminta lowongan dengan nama expected_level' do
      report = jalankan

      expect(baris(report, 'Skill B')['expected_level']).to eq(4)
    end
  end

  describe 'penimpaan nilai oleh penilai (override)' do
    before do
      tambah_skill_lowongan('Skill A', 3)
      tambah_skill_lowongan('Skill B', 3)
      ps_a = tambah_skill_portofolio('Skill A', 1)
      tambah_skill_portofolio('Skill B', 3)
      ps_a.create_assessor_override!(ai_level: 1, override_level: 4, overridden_by: 1, assessor_notes: 'tes')
    end

    it 'memakai level hasil override dan menandainya dengan is_override' do
      report = jalankan

      expect(baris(report, 'Skill A')).to include('candidate_level' => 4, 'result' => 'exceed', 'is_override' => true)
    end

    it 'tidak menandai skill tanpa override' do
      report = jalankan

      expect(baris(report, 'Skill B')['is_override']).to eq(false)
    end
  end

  describe 'ketika pemanggilan model Gemini gagal' do
    before do
      tambah_skill_lowongan('Skill A', 3)
      tambah_skill_lowongan('Skill B', 4)
      tambah_skill_lowongan('Skill D', 2)
      tambah_skill_portofolio('Skill A', 3)
      tambah_skill_portofolio('Skill B', 1)
    end

    it 'tetap menyimpan laporan tanpa error' do
      expect { jalankan }.to change(FitGapReport, :count).by(1)
    end

    it 'menyebut jumlah skill yang belum dinilai di narasi cadangan' do
      report = jalankan

      expect(report.overall_narrative).to match(/1 not assessed/i)
    end
  end

  describe 'pencocokan label skill' do
    it 'mencocokkan label tanpa membedakan huruf besar kecil ketika skill_id kosong' do
      tambah_skill_lowongan('Ruby On Rails', 3)
      tambah_skill_portofolio('ruby on rails', 3)

      report = jalankan

      expect(baris(report, 'Ruby On Rails')).to include('result' => 'match')
    end
  end
end
