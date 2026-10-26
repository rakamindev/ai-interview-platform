# frozen_string_literal: true

require 'rails_helper'

# Cross-service contract: the web app's tests render this exact fixture.
# If the API's fit/gap JSON changes shape, this spec fails until the fixture
# (and therefore the web tests) are updated in the same change — the class of
# bug where the API sent `expected_level` while the UI read `required_level`.
#
# Regenerate after an intentional change:
#   UPDATE_CONTRACTS=1 bundle exec rspec spec/contracts
RSpec.describe 'fit/gap report JSON contract' do
  let(:fixture_path) { Rails.root.join('../web/src/test/fixtures/fitgap-report.contract.json') }

  def shape(value)
    case value
    when Hash then value.to_h { |k, v| [k.to_s, shape(v)] }.sort.to_h
    when Array then value.empty? ? [] : [shape(value.first)]
    else value.class.name
    end
  end

  # Nullable fields legitimately vary by row; compare the union of row shapes.
  def row_shapes(rows) = rows.map { |r| r.keys.sort }.uniq

  let(:report_json) do
    allow(Gemini::HttpClient).to receive(:new).and_return(fake_model(ai_narrative))
    scenario = build_fit_gap_scenario(organization: create(:organization, scheme: 'contract-corp'))
    create(:assessor_override, portfolio_skill: scenario[:skills][:design], override_level: 4,
                               assessor_notes: 'Designed the payments platform at previous job')
    FitGap::Scheduler.request(portfolio: scenario[:portfolio], vacancy: scenario[:vacancy])
    FitGapGeneratorWorker.drain

    report = FitGapReport.last
    digest = FitGap::Inputs.new(portfolio: report.portfolio, vacancy: report.vacancy).digest
    JSON.parse(FitGap::ReportPresenter.new(report, current_digest: digest).as_json.to_json)
  end

  it 'matches the fixture consumed by the web app' do
    stable = report_json.merge('id' => 1, 'portfolio_id' => 1, 'vacancy_id' => 1,
                               'generated_at' => '2026-10-23T06:40:00.000Z')

    if ENV['UPDATE_CONTRACTS']
      File.write(fixture_path, "#{JSON.pretty_generate(stable)}\n")
      skip 'fixture regenerated'
    end

    fixture = JSON.parse(File.read(fixture_path))
    expect(report_json.keys.sort).to eq(fixture.keys.sort)
    expect(shape(report_json['summary'])).to eq(shape(fixture['summary']))
    expect(row_shapes(report_json['skill_comparisons'])).to eq(row_shapes(fixture['skill_comparisons']))
    expect(report_json['skill_comparisons'].map { |r| r.slice('skill_label', 'result', 'is_override') })
      .to eq(fixture['skill_comparisons'].map { |r| r.slice('skill_label', 'result', 'is_override') })
  end
end
