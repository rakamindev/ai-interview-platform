require 'rails_helper'

RSpec.describe FitGapReport, type: :model do
  # Reviewer feedback on F3: the key rename (expected_level -> required_level)
  # only fixed reports generated AFTER the change. Rows already persisted still
  # carry `expected_level`, so the "Required" column went blank again for them
  # and the PDF export printed "—". Reads must tolerate both shapes.
  let(:portfolio) { create(:portfolio) }
  let(:vacancy)   { create(:vacancy) }

  def report_with(comparisons)
    described_class.create!(
      portfolio: portfolio, vacancy: vacancy,
      skill_comparisons: comparisons, generated_at: Time.current
    )
  end

  describe '#normalized_skill_comparisons' do
    it 'maps the legacy expected_level key to required_level' do
      report = report_with([{ 'skill_label' => 'React', 'expected_level' => 3, 'candidate_level' => 2,
                              'result' => 'gap', 'delta' => -1 }])

      comparison = report.normalized_skill_comparisons.first

      expect(comparison).to include('required_level' => 3, 'candidate_level' => 2, 'result' => 'gap')
      expect(comparison).not_to have_key('expected_level')
    end

    it 'leaves reports already in the new shape untouched' do
      report = report_with([{ 'skill_label' => 'React', 'required_level' => 4, 'candidate_level' => 4,
                              'result' => 'match', 'delta' => 0 }])

      expect(report.normalized_skill_comparisons.first).to include('required_level' => 4)
    end

    it 'prefers required_level when a row somehow carries both keys' do
      report = report_with([{ 'skill_label' => 'React', 'required_level' => 5, 'expected_level' => 2,
                              'result' => 'gap' }])

      expect(report.normalized_skill_comparisons.first['required_level']).to eq(5)
    end

    it 'handles a mix of legacy and new rows in the same report' do
      report = report_with([
        { 'skill_label' => 'React', 'expected_level' => 3, 'result' => 'match' },
        { 'skill_label' => 'SQL',   'required_level' => 2, 'result' => 'match' }
      ])

      expect(report.normalized_skill_comparisons.map { |c| c['required_level'] }).to eq([3, 2])
    end

    it 'keeps required_level nil (not a crash) when neither key is present' do
      report = report_with([{ 'skill_label' => 'React', 'result' => 'not_assessed' }])

      expect(report.normalized_skill_comparisons.first['required_level']).to be_nil
    end

    it 'does not mutate the persisted JSON (read-time only, nothing to roll back)' do
      report = report_with([{ 'skill_label' => 'React', 'expected_level' => 3, 'result' => 'match' }])

      report.normalized_skill_comparisons

      expect(report.reload.skill_comparisons.first).to have_key('expected_level')
    end
  end
end
