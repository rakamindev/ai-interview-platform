# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::PortfolioSkills', type: :request do
  let!(:org) { create(:organization, scheme: 'demo') }
  let(:headers) { auth_headers(user_id: 1, role: 'assessor', scheme: 'demo') }
  let(:assessment) { create(:assessment, tenant_id: org.id) }
  let(:session_record) { create(:session, assessment: assessment, tenant_id: org.id) }
  let(:portfolio) { create(:portfolio, session: session_record) }
  let!(:skill) { create(:portfolio_skill, portfolio: portfolio, ai_level: 2) }
  let(:vacancy) { create(:vacancy, tenant_id: org.id) }
  let!(:stale_report) { create(:fit_gap_report, portfolio: portfolio, vacancy: vacancy) }

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    it 'creates a new assessor override and enqueues fitgap regeneration' do
      expect(FitGapGeneratorWorker).to receive(:perform_async).with(portfolio.id, vacancy.id)

      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params: {
             override: {
               override_level: 4,
               assessor_notes: 'Demonstrated senior architectural design.'
             }
           }.to_json,
           headers: headers

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json['override']['override_level']).to eq(4)
      expect(json['override']['ai_level']).to eq(2) # original preserved
      expect(skill.reload.assessor_override.override_level).to eq(4)
    end

    it 'updates an existing assessor override' do
      create(:assessor_override, portfolio_skill: skill, ai_level: 2, override_level: 3)
      expect(FitGapGeneratorWorker).to receive(:perform_async).with(portfolio.id, vacancy.id)

      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params: {
             override: {
               override_level: 5,
               assessor_notes: 'Updated score after team calibration.'
             }
           }.to_json,
           headers: headers

      expect(response).to have_http_status(:ok)
      expect(skill.reload.assessor_override.override_level).to eq(5)
    end

    it 'returns 422 if override level is outside 1..5 range' do
      post "/api/v1/portfolio_skills/#{skill.id}/override",
           params: {
             override: {
               override_level: 10,
               assessor_notes: 'Invalid score'
             }
           }.to_json,
           headers: headers

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'enforces multi-tenant isolation and returns 404 for another tenant portfolio skill' do
      other_org = create(:organization, scheme: 'other-tenant')
      other_assessment = create(:assessment, tenant_id: other_org.id)
      other_session = create(:session, assessment: other_assessment, tenant_id: other_org.id)
      other_portfolio = create(:portfolio, session: other_session)
      other_skill = create(:portfolio_skill, portfolio: other_portfolio, ai_level: 3)

      post "/api/v1/portfolio_skills/#{other_skill.id}/override",
           params: {
             override: {
               override_level: 4,
               assessor_notes: 'Cross-tenant attempt'
             }
           }.to_json,
           headers: headers

      expect(response).to have_http_status(:not_found)
    end
  end
end
