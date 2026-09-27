# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Tenant isolation of candidate portfolios', type: :request do
  before do
    @organization = Organization.create!(
      name: 'Owner Org', scheme: 'owner-org', identifier: 'owner-org', host: 'owner-org.test'
    )
    @other_organization = Organization.create!(
      name: 'Other Org', scheme: 'other-org', identifier: 'other-org', host: 'other-org.test'
    )
    within_organization do
      assessment = Assessment.new(name: 'Jr. Backend Engineer', time_limit_min: 30, created_by: 1)
      assessment.save!
      @session = Session.new(assessment: assessment, candidate_name: 'Test Candidate A', status: 'ended')
      @session.save!
      @vacancy = Vacancy.new(role_title: 'Backend Engineer', created_by: 1)
      @vacancy.save!
    end
    within_organization(@other_organization) do
      @other_vacancy = Vacancy.new(role_title: 'Other Role', created_by: 1)
      @other_vacancy.save!
    end
    @portfolio = Portfolio.create!(session: @session, generation_status: 'complete', generated_at: Time.current)
    @skill = @portfolio.portfolio_skills.create!(
      skill_label: 'RESTful API Design', ai_level: 2, ai_confidence: 'medium', competency_summary: 'Test summary'
    )
    @report = FitGapReport.create!(portfolio: @portfolio, vacancy: @vacancy, skill_comparisons: [{ skill: 'Test' }])
  end

  describe 'another organization' do
    it 'cannot see the portfolio through the session route' do
      get_json "/api/v1/sessions/#{@session.id}/portfolio", {}, as_admin(@other_organization)

      expect(response).to have_http_status(404)
    end

    it 'cannot export the portfolio' do
      get_json "/api/v1/portfolios/#{@portfolio.id}/export", { format: 'json' }, as_admin(@other_organization)

      expect(response).to have_http_status(404)
    end

    it "cannot override a candidate's skill level" do
      post_json "/api/v1/portfolio_skills/#{@skill.id}/override",
                { override: { override_level: 5, assessor_notes: 'Changed by another organization' } },
                as_admin(@other_organization)

      expect(response).to have_http_status(404)
      expect(AssessorOverride.count).to eq(0)
    end

    it 'cannot read an existing fit-gap report' do
      get_json "/api/v1/portfolios/#{@portfolio.id}/fitgap/#{@vacancy.id}", {}, as_admin(@other_organization)

      expect(response).to have_http_status(404)
    end

    it 'cannot generate a fit-gap report against its own vacancy' do
      post_json "/api/v1/portfolios/#{@portfolio.id}/fitgap", { vacancy_id: @other_vacancy.id },
                as_admin(@other_organization)

      expect(response).to have_http_status(404)
      expect(FitGapGeneratorWorker.jobs.size).to eq(0)
    end

    it 'cannot regenerate a fit-gap report' do
      post_json "/api/v1/portfolios/#{@portfolio.id}/regenerate_fitgap", { vacancy_id: @other_vacancy.id },
                as_admin(@other_organization)

      expect(response).to have_http_status(404)
      expect(FitGapGeneratorWorker.jobs.size).to eq(0)
    end
  end

  describe 'the owning organization' do
    it 'can still export the portfolio' do
      get_json "/api/v1/portfolios/#{@portfolio.id}/export", { format: 'json' }, as_admin(@organization)

      expect(response).to have_http_status(200)
    end

    it "can still override a candidate's skill level" do
      post_json "/api/v1/portfolio_skills/#{@skill.id}/override",
                { override: { override_level: 3, assessor_notes: 'Reviewed' } }, as_admin(@organization)

      expect(response).to have_http_status(201)
    end

    it 'can still read its fit-gap report' do
      get_json "/api/v1/portfolios/#{@portfolio.id}/fitgap/#{@vacancy.id}", {}, as_admin(@organization)

      expect(response).to have_http_status(200)
    end
  end
end
