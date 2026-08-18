# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'versions:backfill rake task' do
  it 'backfills versions for pre-existing rows, re-points dependents, and is idempotent' do
    vacancy = create(:vacancy)
    session = create(:session)
    portfolio = Portfolio.create!(session_id: session.id)
    fit_gap_report = FitGapReport.create!(portfolio_id: portfolio.id, vacancy_id: vacancy.id,
                                           skill_comparisons: [{ 'skill_id' => 'test', 'result' => 'match' }])
    assessment = session.assessment

    # Simulate pre-migration legacy rows: strip the versions the model callbacks already created.
    VacancyVersion.where(vacancy_id: vacancy.id).delete_all
    AssessmentVersion.where(assessment_id: assessment.id).delete_all
    fit_gap_report.update_column(:vacancy_version_id, nil)
    session.update_column(:assessment_version_id, nil)

    expect do
      Rake::Task['versions:backfill'].invoke
    end.to change(VacancyVersion, :count).by(1).and change(AssessmentVersion, :count).by(1)

    expect(fit_gap_report.reload.vacancy_version_id).to eq(VacancyVersion.find_by(vacancy_id: vacancy.id).id)
    expect(session.reload.assessment_version_id).to eq(AssessmentVersion.find_by(assessment_id: assessment.id).id)

    Rake::Task['versions:backfill'].reenable
    expect do
      Rake::Task['versions:backfill'].invoke
    end.to change(VacancyVersion, :count).by(0).and change(AssessmentVersion, :count).by(0)
  end
end
