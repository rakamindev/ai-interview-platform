# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Unpublished and Partial Results Protection', type: :request do
  let!(:org) { Organization.create!(id: 320, scheme: 'test-org', name: 'Test Org', identifier: 'test-org', host: 'localhost') }
  let!(:user) { User.create!(email: 'assessor_unpub@example.com', password: 'password123', role: 'admin') }
  let(:token) { JsonWebToken.encode({ user_id: user.id, role: 'admin', scheme: org.scheme }) }
  let(:headers) { { 'Authorization' => "Bearer #{token}", 'Content-Type' => 'application/json' } }

  let!(:assessment) { Assessment.unscoped.create!(tenant_id: org.id, name: 'Unpublished Spec Assessment', created_by: user.id, time_limit_min: 30) }
  let!(:session) { Session.unscoped.create!(tenant_id: org.id, assessment_id: assessment.id, candidate_id: 920, status: 'ended') }
  let!(:portfolio) { session.create_portfolio!(candidate_id: session.candidate_id, generation_status: 'pending') }
  let!(:vacancy) { Vacancy.unscoped.create!(tenant_id: org.id, created_by: user.id, role_title: 'Engineer', culture_dimensions: 'A', competency_expectations: 'A') }

  describe '1. GET /sessions/:id/portfolio protects against leaking unpublished partial rows' do
    it 'returns failed state with skills: [] when status is failed and generated_at is nil' do
      portfolio.update!(generation_status: 'failed', generated_at: nil, generation_error: 'Internal crash')
      portfolio.portfolio_skills.create!(
        skill_label: 'Secret Unfinished Skill',
        ai_level: 2,
        ai_confidence: 'low',
        competency_summary: 'Unpublished partial analysis',
        evidence: []
      )

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers
      expect(response).to have_http_status(:ok)

      body = JSON.parse(response.body)
      expect(body['status']).to eq('failed')
      expect(body['portfolio']['skills']).to eq([])
      expect(body['portfolio']['overrides']).to eq([])
      expect(response.body).not_to include('Secret Unfinished Skill')
    end

    it 'returns status generating and portfolio: nil when status is generating and generated_at is nil' do
      portfolio.update!(generation_status: 'generating', generated_at: nil)
      portfolio.portfolio_skills.create!(
        skill_label: 'Incomplete Generating Skill',
        ai_level: 3,
        ai_confidence: 'medium',
        competency_summary: 'In progress',
        evidence: []
      )

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers
      expect(response).to have_http_status(:accepted)

      body = JSON.parse(response.body)
      expect(body['status']).to eq('generating')
      expect(body['portfolio']).to be_nil
      expect(response.body).not_to include('Incomplete Generating Skill')
    end

    it 'returns unavailable status when status is complete but generated_at is nil' do
      portfolio.update!(generation_status: 'complete', generated_at: nil)
      portfolio.portfolio_skills.create!(
        skill_label: 'Orphaned Complete Skill',
        ai_level: 4,
        ai_confidence: 'high',
        competency_summary: 'Orphaned',
        evidence: []
      )

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers
      expect(response).to have_http_status(:ok)

      body = JSON.parse(response.body)
      expect(body['status']).to eq('unavailable')
      expect(body['portfolio']).to be_nil
      expect(response.body).not_to include('Orphaned Complete Skill')
    end
  end

  describe '2. Protect Export and Fit/Gap from unpublished portfolios' do
    it 'rejects export with 422 when portfolio is marked complete but generated_at is nil' do
      portfolio.update!(generation_status: 'complete', generated_at: nil)
      portfolio.portfolio_skills.create!(
        skill_label: 'Unpublished Skill',
        ai_level: 3,
        ai_confidence: 'high',
        competency_summary: 'Unpublished',
        evidence: []
      )

      get "/api/v1/portfolios/#{portfolio.id}/export?format=json", headers: headers
      expect(response).to have_http_status(:unprocessable_entity)

      get "/api/v1/portfolios/#{portfolio.id}/export?format=pdf", headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'rejects fitgap and regenerate_fitgap with 422 when portfolio is marked complete but generated_at is nil' do
      portfolio.update!(generation_status: 'complete', generated_at: nil)

      post "/api/v1/portfolios/#{portfolio.id}/fitgap", headers: headers, params: { vacancy_id: vacancy.id }.to_json
      expect(response).to have_http_status(:unprocessable_entity)

      post "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", headers: headers, params: { vacancy_id: vacancy.id }.to_json
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'succeeds for export and fitgap when portfolio is published and complete' do
      portfolio.update!(generation_status: 'complete', generated_at: 1.hour.ago)
      portfolio.portfolio_skills.create!(
        skill_label: 'Published Skill',
        ai_level: 4,
        ai_confidence: 'high',
        competency_summary: 'Published',
        evidence: ['Quote']
      )

      get "/api/v1/portfolios/#{portfolio.id}/export?format=json", headers: headers
      expect(response).to have_http_status(:ok)

      post "/api/v1/portfolios/#{portfolio.id}/fitgap", headers: headers, params: { vacancy_id: vacancy.id }.to_json
      expect(response).to have_http_status(:accepted)
    end
  end

  describe '3. Protect GET /portfolios/:id/fitgap/:vacancy_id from unpublished portfolios' do
    it 'A. rejects show_fitgap with 422 when portfolio is complete but generated_at is nil, even if report exists' do
      portfolio.update!(generation_status: 'complete', generated_at: nil)
      skill = portfolio.portfolio_skills.create!(
        skill_label: 'Unpublished Skill',
        ai_level: 3,
        ai_confidence: 'high',
        competency_summary: 'Summary',
        evidence: []
      )
      FitGapReport.create!(
        portfolio_id: portfolio.id,
        vacancy_id: vacancy.id,
        skill_comparisons: [{ 'skill_label' => 'Unpublished Skill', 'result' => 'match' }],
        culture_narrative: 'Top secret culture match',
        overall_narrative: 'Top secret overall narrative',
        generated_at: Time.current
      )

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.body).not_to include('Top secret culture match')
    end

    it 'B. rejects show_fitgap with 422 when portfolio is failed and unpublished' do
      portfolio.update!(generation_status: 'failed', generated_at: nil)
      FitGapReport.create!(
        portfolio_id: portfolio.id,
        vacancy_id: vacancy.id,
        skill_comparisons: [{ 'skill_label' => 'Old Skill', 'result' => 'gap' }],
        culture_narrative: 'Old narrative',
        overall_narrative: 'Old narrative',
        generated_at: Time.current
      )

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'C. succeeds with 200 OK for show_fitgap when portfolio is published and complete' do
      portfolio.update!(generation_status: 'complete', generated_at: 1.hour.ago)
      portfolio.portfolio_skills.create!(
        skill_label: 'Published Skill',
        ai_level: 4,
        ai_confidence: 'high',
        competency_summary: 'Summary',
        evidence: ['Quote']
      )
      FitGapReport.create!(
        portfolio_id: portfolio.id,
        vacancy_id: vacancy.id,
        skill_comparisons: [{ 'skill_label' => 'Published Skill', 'result' => 'match' }],
        culture_narrative: 'Valid culture match',
        overall_narrative: 'Valid recommendation',
        generated_at: Time.current
      )

      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: headers
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body['report']['culture_narrative']).to eq('Valid culture match')
    end
  end

  describe '4. Protect POST /portfolio_skills/:id/override from unpublished and generating portfolios' do
    it 'A. rejects override with 422 for unpublished partial skill' do
      portfolio.update!(generation_status: 'generating', generated_at: nil)
      skill = portfolio.portfolio_skills.create!(
        skill_label: 'Unpublished Skill',
        ai_level: 2,
        ai_confidence: 'low',
        competency_summary: 'Summary',
        evidence: []
      )

      expect {
        post "/api/v1/portfolio_skills/#{skill.id}/override",
             headers: headers,
             params: { override: { override_level: 4, assessor_notes: 'Attempted override' } }.to_json
      }.not_to change(AssessorOverride, :count)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.body).to include('Portfolio is not ready for override')
    end

    it 'B. rejects override with 422 when portfolio is actively generating, even with previous published result' do
      portfolio.update!(generation_status: 'generating', generated_at: 1.hour.ago)
      skill = portfolio.portfolio_skills.create!(
        skill_label: 'Preserved Skill',
        ai_level: 3,
        ai_confidence: 'high',
        competency_summary: 'Summary',
        evidence: ['Quote']
      )

      expect {
        post "/api/v1/portfolio_skills/#{skill.id}/override",
             headers: headers,
             params: { override: { override_level: 5, assessor_notes: 'Attempted override during regeneration' } }.to_json
      }.not_to change(AssessorOverride, :count)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.body).to include('Portfolio is not ready for override')
    end

    it 'C. succeeds with 201 Created for override on published complete portfolio' do
      portfolio.update!(generation_status: 'complete', generated_at: 1.hour.ago)
      skill = portfolio.portfolio_skills.create!(
        skill_label: 'Published Skill',
        ai_level: 3,
        ai_confidence: 'high',
        competency_summary: 'Summary',
        evidence: ['Quote']
      )

      expect {
        post "/api/v1/portfolio_skills/#{skill.id}/override",
             headers: headers,
             params: { override: { override_level: 4, assessor_notes: 'Legitimate override' } }.to_json
      }.to change(AssessorOverride, :count).by(1)

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body['override']['override_level']).to eq(4)
      expect(body['override']['assessor_notes']).to eq('Legitimate override')
    end
  end
end
