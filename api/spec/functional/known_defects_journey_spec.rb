# frozen_string_literal: true

require 'rails_helper'

# Journeys that go wrong today, from assessment/03-problem-and-gap.md. Each is
# `pending`: RSpec runs it and expects it to FAIL. When the defect is fixed,
# RSpec reports "Expected pending ... to fail" and the marker must be removed.
RSpec.describe 'Known defects, end to end', type: :request do
  let!(:organization) { create(:organization) }
  let!(:assessor)     { create(:user, password: 'correct-horse-battery') }
  let(:headers)       { sign_in_as(assessor, organization) }
  let(:assessment)    { create(:assessment, :with_skills, organization:) }
  let(:session)       { create(:session, assessment:) }

  describe 'the candidate ends the interview at minute 6, after only React was discussed' do
    # The model answers honestly: no level for the skills it has no evidence for.
    let(:honest_output) do
      { 'configured_skills' => [
        { 'skill_id' => 'SK-ENG-001', 'skill_label' => 'React', 'level' => 3, 'confidence' => 'medium',
          'evidence' => ['We profiled with React DevTools.'], 'competency_summary' => 'L3 so far.' },
        { 'skill_id' => 'SK-SOFT-001', 'skill_label' => 'Communication', 'level' => nil, 'confidence' => 'low',
          'evidence' => [], 'competency_summary' => 'Not assessed.' },
        { 'skill_id' => 'SK-ENG-003', 'skill_label' => 'System Design', 'level' => nil, 'confidence' => 'low',
          'evidence' => [], 'competency_summary' => 'Not assessed.' }
      ] }
    end

    let(:narrative) { { 'culture_narrative' => 'n/a', 'overall_narrative' => 'n/a' } }

    before do
      stub_gemini(portfolio: honest_output, narrative:)
      simulate_interview(session, turns: [['candidate', 'We profiled with React DevTools.']],
                                  coverage: { 'React' => ['partial', 2] })
      post "/api/v1/sessions/#{session.id}/end_session", headers:,
                                                        params: { session: { reason: 'manual_candidate' } }.to_json
      run_jobs(PortfolioGeneratorWorker)
    end

    it 'P0-1: shows the assessor the skills nobody asked about as having no level' do
      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      levels = json.dig('portfolio', 'skills').to_h { [_1['skill_label'], _1['ai_level']] }
      expect(levels).to eq('React' => 3, 'Communication' => nil, 'System Design' => nil)
    end

    it 'P1-1: reports those skills as not assessed in fit/gap, not as gaps' do
      vacancy = create(:vacancy, organization:)
      create(:vacancy_skill, vacancy:, skill_id: 'SK-SOFT-001', skill_label: 'Communication', expected_level: 3)
      portfolio_id = session.reload.portfolio.id

      post "/api/v1/portfolios/#{portfolio_id}/fitgap", headers:, params: { fitgap: { vacancy_id: vacancy.id } }.to_json
      run_jobs(FitGapGeneratorWorker)
      get "/api/v1/portfolios/#{portfolio_id}/fitgap/#{vacancy.id}", headers: headers

      expect(json.dig('report', 'skill_comparisons').sole).to include('result' => 'not_assessed', 'candidate_level' => nil)
    end
  end

  describe 'the invite link' do
    it 'P1-10: does not let the link holder end an interview that never started as "all covered"' do
      post "/api/v1/sessions/#{session.invite_token}/audio_complete"

      expect(session.reload).to have_attributes(status: 'pending', end_reason: nil)
      expect(PortfolioGeneratorWorker.jobs).to be_empty
    end

    it 'P1-10: does not let the link holder end a live interview the server is not finishing' do
      session.update!(status: 'active', started_at: 5.minutes.ago)

      post "/api/v1/sessions/#{session.invite_token}/audio_complete"

      expect(response).to have_http_status(:conflict)
      expect(session.reload).to have_attributes(status: 'active', end_reason: nil)
      expect(PortfolioGeneratorWorker.jobs).to be_empty
    end

    it 'P1-10: ends the interview once the server has told the page to finish' do
      session.update!(status: 'active', started_at: 5.minutes.ago, ending_requested_at: 2.seconds.ago)

      post "/api/v1/sessions/#{session.invite_token}/audio_complete"

      expect(response).to have_http_status(:ok)
      expect(session.reload).to have_attributes(status: 'ended', end_reason: 'all_covered')
      expect(PortfolioGeneratorWorker.jobs.size).to eq(1)
    end
  end
end
