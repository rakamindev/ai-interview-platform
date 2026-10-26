# frozen_string_literal: true

require 'rails_helper'
require Rails.root.join('db/migrate/20261023000000_add_lifecycle_to_fit_gap_reports')

# Postgres DDL is transactional, so running the migration down/up inside the
# example's transaction leaves the test schema untouched afterwards.
RSpec.describe AddLifecycleToFitGapReports do
  let(:connection) { ActiveRecord::Base.connection }
  let(:migration) { described_class.new.tap { |m| m.verbose = false } }

  def columns = connection.columns(:fit_gap_reports).map(&:name)

  def insert_legacy_report(portfolio, vacancy)
    connection.execute(<<~SQL)
      INSERT INTO fit_gap_reports (portfolio_id, vacancy_id, skill_comparisons, overall_narrative)
      VALUES (#{portfolio.id}, #{vacancy.id}, '[{"result":"match"}]', 'legacy')
    SQL
  end

  it 'backfills existing reports as complete and defaults new ones to pending' do
    org = create(:organization)
    portfolio = create(:portfolio, session: create(:session, assessment: create(:assessment, organization: org)))
    vacancy = create(:vacancy, organization: org)

    migration.migrate(:down)
    expect(columns).not_to include('status')
    insert_legacy_report(portfolio, vacancy)

    migration.migrate(:up)
    FitGapReport.reset_column_information

    legacy = FitGapReport.find_by!(portfolio_id: portfolio.id)
    expect(legacy.status).to eq('complete')
    expect(legacy.overall_narrative).to eq('legacy')
    expect(FitGapReport.new.status).to eq('pending')
    expect(FitGapReport.new.skill_comparisons).to eq([])
  end

  it 'is reversible' do
    migration.migrate(:down)
    expect(columns).not_to include('status', 'inputs_digest', 'narrative_source', 'error_message')
    migration.migrate(:up)
    expect(columns).to include('status', 'inputs_digest', 'narrative_source', 'error_message', 'queued_at', 'generation_started_at')
  end

  after { FitGapReport.reset_column_information }
end
