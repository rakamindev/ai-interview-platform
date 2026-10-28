# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::LegacyLevelRepair do
  let(:org) { create_organization('acme') }
  let(:session_record) { as_tenant(org) { create(:session, assessment: create(:assessment)) } }
  let(:portfolio) { create(:portfolio, session: session_record) }
  let(:vacancy) { as_tenant(org) { create(:vacancy) } }

  # Legacy state: System Design was never probed but was stored as L1.
  let!(:fabricated) { create(:portfolio_skill, portfolio:, skill_label: 'System Design', ai_level: 1, ai_confidence: 'low') }
  let!(:real)       { create(:portfolio_skill, portfolio:, skill_label: 'React', ai_level: 3) }

  before do
    create(:coverage_map, session: session_record, skill_label: 'system design', state: 'not_yet', probe_count: 0)
    create(:coverage_map, session: session_record, skill_label: 'React', state: 'covered', probe_count: 4)
    FitGapReport.create!(portfolio:, vacancy:, skill_comparisons: [{ skill_label: 'System Design', result: 'gap' }])
  end

  it 'only reports what it would change on a dry run' do
    result = described_class.new.call

    expect(result.skill_ids).to eq([fabricated.id])
    expect(fabricated.reload.ai_level).to eq(1)
    expect(FitGapReport.count).to eq(1)
  end

  it 'marks never-probed skills not assessed, leaves real ratings, and re-queues fit/gap' do
    described_class.new(apply: true).call

    expect(fabricated.reload).to have_attributes(assessment_status: 'not_assessed', ai_level: nil, status_reason: 'never_reached')
    expect(real.reload).to have_attributes(assessment_status: 'assessed', ai_level: 3)
    expect(FitGapReport.count).to eq(0)
    expect(FitGapGeneratorWorker.jobs.map { |j| j['args'] }).to eq([[portfolio.id, vacancy.id]])
  end

  it 'keeps an assessor’s rating on a repaired skill' do
    fabricated.create_assessor_override!(ai_level: 1, override_level: 2, overridden_by: 1, assessor_notes: 'Phone screen')
    described_class.new(apply: true).call

    expect(fabricated.reload.assessor_override).to have_attributes(override_level: 2, ai_level: nil)
    expect(fabricated.effective_level).to eq(2)
  end

  it 'is idempotent' do
    described_class.new(apply: true).call
    expect(described_class.new(apply: true).call.skill_ids).to be_empty
  end
end
