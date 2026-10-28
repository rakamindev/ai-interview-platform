# frozen_string_literal: true

require 'rails_helper'

# AC6.3, AC6.4 and F8: overrides are validated, an override on a skill the interview never measured
# must say what it is based on, and saving one never deletes the fit/gap report the user is reading.
RSpec.describe 'POST /api/v1/portfolio_skills/:id/override', type: :request do
  let(:org) { create(:organization) }
  let(:headers) { auth_headers_for(org, user_id: 7) }
  let(:portfolio) { create(:portfolio, organization: org) }
  let(:skill) { create(:portfolio_skill, portfolio: portfolio, ai_level: 2) }
  let(:unrated) do
    create(:portfolio_skill, portfolio: portfolio, assessment_status: 'not_assessed', ai_level: nil,
                             ai_confidence: nil, competency_summary: '')
  end

  def override!(target, level: 3, notes: nil)
    post "/api/v1/portfolio_skills/#{target.id}/override",
         params: { override: { override_level: level, assessor_notes: notes }.compact }, headers: headers, as: :json
  end

  def error_message
    JSON.parse(response.body).dig('errors', 0, 'message')
  end

  it 'records who overrode, when, and the AI level it replaced' do
    override!(skill, level: 4, notes: 'Stronger in the follow-up.')

    expect(response).to have_http_status(:created)
    expect(skill.reload.assessor_override).to have_attributes(ai_level: 2, override_level: 4, overridden_by: 7)
    expect(JSON.parse(response.body).dig('override', 'overridden_at')).to be_present
  end

  [0, 6, 'abc', 4.5].each do |level|
    it "rejects override_level #{level.inspect} with a message" do
      override!(skill, level: level)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(error_message).to match(/Override level/)
      expect(skill.reload.assessor_override).to be_nil
    end
  end

  it 'rejects notes longer than 2,000 characters' do
    override!(skill, notes: 'x' * 2_001)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(error_message).to match(/Assessor notes is too long/)
  end

  it 'requires a note when the skill was not assessed in the interview (AC6.3)' do
    override!(unrated, level: 2)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(error_message).to eq('Add a note: this skill was not assessed in the interview, so say what your rating is based on.')
  end

  it 'accepts an override with a note on a skill that was not assessed (AC6.3)' do
    override!(unrated, level: 2, notes: 'Discussed it in the follow-up call.')

    expect(response).to have_http_status(:created)
    expect(unrated.reload.assessor_override).to have_attributes(ai_level: nil, override_level: 2)
  end

  it 'updates an existing override and keeps the original AI level' do
    override!(skill, level: 4, notes: 'First pass.')
    override!(skill, level: 3, notes: 'Second pass.')

    expect(response).to have_http_status(:ok)
    expect(skill.reload.assessor_override).to have_attributes(ai_level: 2, override_level: 3,
                                                              assessor_notes: 'Second pass.')
  end

  it 'keeps the existing fit/gap report and queues a refresh (F8)' do
    report = create(:fit_gap_report, portfolio: portfolio, vacancy: create(:vacancy, organization: org))

    override!(skill, level: 4)

    expect(FitGapReport.exists?(report.id)).to be(true)
    expect(FitGapGeneratorWorker.jobs.map { |j| j['args'].first(2) }).to eq([[portfolio.id, report.vacancy_id]])
    # Nothing else was running, so the refresh owns the lock.
    expect(FitGapGeneratorWorker.jobs.first['args'].last).to be_a(String)
  end
end
