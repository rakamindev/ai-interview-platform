require 'rails_helper'

RSpec.describe 'Fit/Gap reports saved before the required_level rename', type: :request do
  # Reviewer feedback on F3: persisted reports still use `expected_level`.
  # The API (and therefore the UI table + JSON export) and the PDF export must
  # keep showing the vacancy's required level for those rows.
  let!(:organization) { create(:organization) }
  let(:headers) { assessor_auth_headers(organization: organization) }
  let(:assessment) { create(:assessment, tenant_id: organization.id) }
  let(:session) { create(:session, assessment: assessment, tenant_id: organization.id, status: 'ended') }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:vacancy) { create(:vacancy, tenant_id: organization.id) }

  let!(:legacy_report) do
    FitGapReport.create!(
      portfolio: portfolio, vacancy: vacancy, generated_at: Time.current,
      skill_comparisons: [{ 'skill_label' => 'React', 'expected_level' => 4, 'candidate_level' => 3,
                            'result' => 'gap', 'delta' => -1 }]
    )
  end

  it 'GET fitgap/:vacancy_id returns required_level for a legacy row' do
    get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers

    expect(response).to have_http_status(:ok)
    comparison = JSON.parse(response.body)['report']['skill_comparisons'].first
    expect(comparison['required_level']).to eq(4)
  end

  it 'PDF export prints the required level for a legacy row instead of a dash' do
    # prawn-table adds #table per document instance, so spy on the class that
    # actually receives the rows.
    tables = []
    allow(Prawn::Table).to receive(:new).and_wrap_original do |original, data, *args, &block|
      tables << data
      original.call(data, *args, &block)
    end

    Exports::PdfGenerator.new(portfolio: portfolio, vacancy: vacancy).call

    fit_gap_table = tables.find { |rows| rows.first == ['Skill', 'Required', 'Candidate', 'Result', 'Delta'] }
    expect(fit_gap_table).not_to be_nil
    expect(fit_gap_table[1][1]).to eq('L4')
  end
end
