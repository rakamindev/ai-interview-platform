# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Exports::PdfGenerator, type: :service do
  let!(:organization) do
    Organization.create!(
      name: 'Organisasi PDF',
      scheme: 'pdf-test',
      identifier: 'pdf-test',
      host: 'pdf-test.local'
    )
  end
  let!(:assessment) do
    Assessment.create!(
      tenant_id: organization.id,
      created_by: 42,
      name: 'Fullstack Engineer – Indonesia',
      time_limit_min: 30,
      language: 'id'
    )
  end
  let!(:session) do
    Session.create!(
      tenant_id: organization.id,
      assessment: assessment,
      candidate_name: 'Kandidat Uji',
      status: 'ended',
      duration_seconds: 615
    )
  end
  let!(:portfolio) do
    Portfolio.create!(session: session, generation_status: 'complete')
  end
  let!(:vacancy) do
    Vacancy.create!(tenant_id: organization.id, created_by: 42, role_title: 'Product Engineer')
  end

  before do
    Current.organization = organization
    Current.tenant_id = organization.id

    PortfolioSkill.create!(
      portfolio: portfolio,
      skill_label: 'Komunikasi & Kolaborasi',
      ai_level: 3,
      ai_confidence: 'high',
      competency_summary: 'Menjelaskan trade-off dengan jelas – tanpa menghilangkan konteks.',
      evidence: ['“Saya memilih opsi ini karena dampaknya lebih kecil.”']
    )
    FitGapReport.create!(
      portfolio: portfolio,
      vacancy: vacancy,
      skill_comparisons: [
        {
          skill_label: 'Komunikasi & Kolaborasi',
          expected_level: 3,
          candidate_level: 3,
          result: 'match',
          delta: 0
        }
      ],
      overall_narrative: 'Ringkasan berbasis aturan – narasi AI sedang tidak tersedia.',
      narrative_source: 'rule_based_fallback'
    )
  end

  it 'menghasilkan PDF valid untuk teks Unicode dan fallback narrative' do
    pdf = described_class.new(portfolio: portfolio, vacancy: vacancy).call

    expect(pdf).to start_with('%PDF')
    expect(pdf.bytesize).to be > 1_000
  end
end
