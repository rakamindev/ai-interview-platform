# frozen_string_literal: true

require 'rails_helper'

# AC9.1 and F10: PDF export works for the portfolios assessors actually send on: corrected ones,
# with Indonesian text, typographic punctuation, non-Latin names, emoji and very long text.
RSpec.describe 'GET /api/v1/portfolios/:id/export?format=pdf', type: :request do
  let(:org) { create(:organization) }
  let(:headers) { auth_headers_for(org) }
  let(:session) { create(:session, organization: org, candidate_name: 'Ζωή Ηλιοπούλου (fake)') }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:vacancy) { create(:vacancy, organization: org, role_title: 'Frontend Engineer — Intern') }

  before do
    skill = create(:portfolio_skill, portfolio: portfolio, skill_label: 'Komunikasi & Kolaborasi',
                                     evidence: ['“Saya selalu menulis ringkasan setelah rapat.” 👍', 'Ёлка, 東京, naïve café'],
                                     competency_summary: 'Penjelasannya runtut. ' * 250)
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'Testing', assessment_status: 'not_assessed',
                             ai_level: nil, ai_confidence: nil, competency_summary: '')
    AssessorOverride.create!(portfolio_skill: skill, ai_level: 3, override_level: 4, overridden_by: 1,
                             assessor_notes: 'Naik ke L4 — contoh nyata di follow-up → jelas.')
    create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy,
                            skill_comparisons: [{ 'skill_label' => 'Komunikasi & Kolaborasi', 'expected_level' => 3,
                                                  'candidate_level' => 4, 'result' => 'exceed', 'delta' => 1 }],
                            culture_narrative: 'Cocok dengan budaya “async-first”.')
  end

  def export(params = {})
    get "/api/v1/portfolios/#{portfolio.id}/export", params: { format: 'pdf' }.merge(params), headers: headers
  end

  it 'exports a corrected portfolio with non-Latin text as a PDF' do
    export

    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq('application/pdf')
    expect(response.body).to start_with('%PDF-')
  end

  it 'exports the fit/gap section too' do
    export(vacancy_id: vacancy.id)

    expect(response).to have_http_status(:ok)
    expect(response.body).to start_with('%PDF-')
  end

  describe 'level line' do
    it 'describes an override in words, since the font has no arrow glyph' do
      skill = portfolio.portfolio_skills.find_by(skill_label: 'Komunikasi & Kolaborasi')

      expect(Exports::PdfGenerator.level_text(skill)).to eq('Level: L4 (set by assessor; AI: L3)  |  Confidence: High')
    end

    it 'says when the AI did not assess a skill' do
      skill = portfolio.portfolio_skills.find_by(skill_label: 'Testing')
      expect(Exports::PdfGenerator.level_text(skill)).to eq('Level: Not assessed')

      AssessorOverride.create!(portfolio_skill: skill, override_level: 2, overridden_by: 1, assessor_notes: 'Follow-up call.')
      expect(Exports::PdfGenerator.level_text(skill.reload)).to eq('Level: L2 (set by assessor; AI: Not assessed)')
    end
  end

  describe 'result column' do
    it 'marks provisional and assessor-set results' do
      expect(Exports::PdfGenerator.result_text('result' => 'match', 'provisional' => true)).to eq('Match (provisional)')
      expect(Exports::PdfGenerator.result_text('result' => 'gap', 'overridden' => true)).to eq('Gap (set by assessor)')
      expect(Exports::PdfGenerator.result_text('result' => 'needs_review')).to eq('Needs Review')
    end
  end

  it 'embeds a Unicode font instead of the Windows-1252 built-ins' do
    export

    expect(response.body).to include('NotoSans')
  end
end
