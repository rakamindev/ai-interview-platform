# frozen_string_literal: true

require_relative '../../rails_helper'
require_relative '../../support/assessment_records'

RSpec.describe FitGap::Engine, type: :model do
  include AssessmentRecords
  let(:records) { create_records }
  let(:engine) { described_class.new(portfolio: records[:portfolio], vacancy: records[:vacancy]) }

  it 'upserts one deterministic report without a provider or queue' do
    first = engine.call
    timestamp = first.generated_at
    expect(engine.call.id).to eq(first.id)
    expect(first.reload.generated_at).to eq(timestamp)
    expect(FitGapReport.count).to eq(1)
    expect(first.skill_comparisons.first).to include('expected_level' => 3, 'candidate_level' => 2, 'result' => 'gap')
    expect(first.culture_narrative).to be_nil
  end

  it 'refreshes overrides and vacancy edits' do
    engine.call
    records[:skill].create_assessor_override!(ai_level: 2, override_level: 4, overridden_by: 1)
    expect(engine.call.skill_comparisons.first).to include('candidate_level' => 4, 'rating_source' => 'assessor', 'is_override' => true)
    records[:vacancy].vacancy_skills.first.update!(expected_level: 5)
    expect(engine.call.skill_comparisons.first).to include('expected_level' => 5, 'delta' => -1)
  end

  it 'preserves an earlier report if persistence fails' do
    report = engine.call
    previous = report.attributes
    records[:vacancy].vacancy_skills.first.update!(expected_level: 4)
    allow_any_instance_of(FitGapReport).to receive(:save!).and_raise(ActiveRecord::RecordInvalid.new(report))
    expect { engine.call }.to raise_error(ActiveRecord::RecordInvalid)
    expect(report.reload.attributes).to eq(previous)
  end

  it 'supports a vacancy with no requirements' do
    records[:vacancy].vacancy_skills.destroy_all
    expect(engine.call.skill_comparisons).to eq([])
  end

  it 'rejects comparisons across organizations even outside a request' do
    foreign = create_records(scheme: 'foreign-fixture')
    expect { described_class.new(portfolio: records[:portfolio], vacancy: foreign[:vacancy]).call }.to raise_error(ArgumentError, /same tenant/)
    expect(FitGapReport.count).to eq(0)
  end

  it 'does not compare an incomplete portfolio' do
    records[:portfolio].update!(generation_status: 'failed')
    expect { engine.call }.to raise_error(ArgumentError, /not ready/)
  end
end
