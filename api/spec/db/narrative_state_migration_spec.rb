# frozen_string_literal: true

require 'rails_helper'
require Rails.root.join('db/migrate/20260820000000_add_narrative_state_to_fit_gap_reports')

RSpec.describe AddNarrativeStateToFitGapReports do
  let(:conn) { ActiveRecord::Base.connection }
  let(:org)  { build_org }

  def columns
    FitGapReport.reset_column_information
    conn.columns(:fit_gap_reports).map(&:name)
  end

  around do |example|
    ActiveRecord::Migration.suppress_messages { example.run }
  end

  it 'is reversible: down removes every new column, up restores them' do
    described_class.new.migrate(:down)
    expect(columns).not_to include('narrative_status', 'narrative_digest', 'generation_error', 'summary')

    described_class.new.migrate(:up)
    expect(columns).to include('narrative_status', 'narrative_digest', 'generation_error', 'summary')
  end

  it 'is safe against rows written before the migration: they become ready with an empty summary' do
    portfolio = build_portfolio(build_session(org))
    vacancy   = build_vacancy(org, skills: { 'React' => 3 })

    described_class.new.migrate(:down)
    conn.execute(<<~SQL.squish)
      INSERT INTO fit_gap_reports (portfolio_id, vacancy_id, skill_comparisons, culture_narrative)
      VALUES (#{portfolio.id}, #{vacancy.id}, '[{"skill_label":"React","expected_level":3,"result":"match"}]', 'old text')
    SQL
    described_class.new.migrate(:up)

    row = conn.select_one("SELECT narrative_status, summary, narrative_digest FROM fit_gap_reports")
    expect(row['narrative_status']).to eq('ready')
    summary = row['summary']
    summary = JSON.parse(summary) if summary.is_a?(String)
    expect(summary).to eq({})
    expect(row['narrative_digest']).to be_nil
  end

  it 'rejects an unknown narrative status at the database level' do
    portfolio = build_portfolio(build_session(org))
    vacancy   = build_vacancy(org, skills: { 'React' => 3 })
    FitGapReport.create!(portfolio_id: portfolio.id, vacancy_id: vacancy.id, skill_comparisons: [])

    expect do
      ActiveRecord::Base.transaction(requires_new: true) do
        conn.execute("UPDATE fit_gap_reports SET narrative_status = 'bogus'")
      end
    end.to raise_error(ActiveRecord::StatementInvalid, /chk_fit_gap_reports_narrative_status/)
  end
end
