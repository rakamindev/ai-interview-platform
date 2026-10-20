# frozen_string_literal: true

require 'rails_helper'

# Every authenticated route, called by company B with company A's IDs in the URL or the body. tenant_isolation_spec
# covers the routes P0-2 broke; this one walks the route table, so a new route without a case fails the suite.
RSpec.describe 'Tenant isolation, route by route', type: :request do
  let(:company_a) { create(:organization) }
  let(:company_b) { create(:organization) }

  let!(:assessment) { create(:assessment, :with_skills, organization: company_a) }
  let!(:interview)  { create(:session, assessment:) }
  let!(:portfolio)  { create(:portfolio, session: interview, generation_status: 'failed') }
  let!(:skill)      { create(:portfolio_skill, portfolio:, skill_label: 'React', ai_level: 2) }
  let!(:vacancy)    { create(:vacancy, organization: company_a) }
  let!(:vacancy_skill) { create(:vacancy_skill, vacancy:, skill_label: 'React') }
  let!(:report)     { create(:fit_gap_report, portfolio:, vacancy:) }

  let(:as_b) { auth_headers_for(company_b, user_id: 99) }

  # Routes that hold no company's data, and why. Every other API route needs a case below.
  open_routes = {
    'api/v1/authentication#authenticate' => 'signing in; which company it picks is pinned at the end (C2)',
    'api/v1/skill_taxonomies#index'      => 'shared reference data, the same for every company',
    'api/v1/skill_taxonomies#show'       => 'shared reference data, the same for every company',
    'api/v1/sessions#candidate_info'     => 'candidate link, guarded by the invite token instead of a login',
    'api/v1/sessions#audio_complete'     => 'candidate link, guarded by the invite token instead of a login'
  }

  # Company A's records, called by company B: each must answer 404 and change nothing.
  refused = {
    'api/v1/assessments#show'             => -> { [:get,    "/api/v1/assessments/#{assessment.id}"] },
    'api/v1/assessments#update'           => -> { [:patch,  "/api/v1/assessments/#{assessment.id}", { assessment: { name: 'Taken' } }] },
    'api/v1/assessments#destroy'          => -> { [:delete, "/api/v1/assessments/#{assessment.id}"] },
    'api/v1/sessions#index'               => -> { [:get,    "/api/v1/assessments/#{assessment.id}/sessions"] },
    'api/v1/sessions#create'              => -> { [:post,   "/api/v1/assessments/#{assessment.id}/sessions", { session: { candidate_name: 'Planted' } }] },
    'api/v1/sessions#show'                => -> { [:get,    "/api/v1/sessions/#{interview.id}"] },
    'api/v1/sessions#end_session'         => -> { [:post,   "/api/v1/sessions/#{interview.id}/end_session"] },
    'api/v1/sessions#coverage'            => -> { [:get,    "/api/v1/sessions/#{interview.id}/coverage"] },
    'api/v1/sessions#transcript'          => -> { [:get,    "/api/v1/sessions/#{interview.id}/transcript"] },
    'api/v1/portfolios#show'              => -> { [:get,    "/api/v1/sessions/#{interview.id}/portfolio"] },
    'api/v1/portfolios#regenerate'        => -> { [:post,   "/api/v1/sessions/#{interview.id}/portfolio/regenerate"] },
    'api/v1/portfolio_skills#override'    => -> { [:post,   "/api/v1/portfolio_skills/#{skill.id}/override", { override: { override_level: 5, assessor_notes: 'x' } }] },
    'api/v1/vacancies#show'               => -> { [:get,    "/api/v1/vacancies/#{vacancy.id}"] },
    'api/v1/vacancies#update'             => -> { [:patch,  "/api/v1/vacancies/#{vacancy.id}", { vacancy: { role_title: 'Taken' } }] },
    'api/v1/vacancies#destroy'            => -> { [:delete, "/api/v1/vacancies/#{vacancy.id}"] },
    'api/v1/portfolios#fitgap'            => -> { [:post,   "/api/v1/portfolios/#{portfolio.id}/fitgap", { vacancy_id: vacancy.id }] },
    'api/v1/portfolios#regenerate_fitgap' => -> { [:post,   "/api/v1/portfolios/#{portfolio.id}/regenerate_fitgap", { vacancy_id: vacancy.id }] },
    'api/v1/portfolios#show_fitgap'       => -> { [:get,    "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}"] },
    'api/v1/portfolios#export'            => -> { [:get,    "/api/v1/portfolios/#{portfolio.id}/export", { vacancy_id: vacancy.id }] }
  }

  # Routes with no record in the URL: lists must leave A out, and creates must land in B.
  listed  = { 'api/v1/assessments#index' => '/api/v1/assessments', 'api/v1/vacancies#index' => '/api/v1/vacancies' }
  created = {
    'api/v1/assessments#create' => ['/api/v1/assessments', Assessment, { assessment: { name: 'B role', time_limit_min: 30 } }],
    'api/v1/vacancies#create'   => ['/api/v1/vacancies', Vacancy, { vacancy: { role_title: 'B role' } }]
  }

  # Everything company A owns, read past the tenant scope, plus the job queue: a refused call must leave it as it was.
  def company_a_data
    [
      Assessment.unscoped.where(tenant_id: company_a.id),
      AssessmentSkill.unscoped.where(assessment_id: assessment.id),
      Session.unscoped.where(tenant_id: company_a.id),
      Portfolio.unscoped.where(session_id: interview.id),
      PortfolioSkill.unscoped.where(portfolio_id: portfolio.id),
      AssessorOverride.unscoped.where(portfolio_skill_id: skill.id),
      FitGapReport.unscoped.where(portfolio_id: portfolio.id),
      Vacancy.unscoped.where(tenant_id: company_a.id),
      VacancySkill.unscoped.where(vacancy_id: vacancy.id)
    ].map { |rows| rows.order(:id).map(&:attributes) } << Sidekiq::Worker.jobs.size
  end

  def call_as_b(verb, path, body = nil)
    params = verb == :get ? body : body&.to_json
    send(verb, path, params:, headers: as_b)
  end

  it 'has a case for every API route, and no case for a route that is gone' do
    routes = Rails.application.routes.routes.filter_map do |route|
      controller, action = route.defaults.values_at(:controller, :action)
      "#{controller}##{action}" if controller&.start_with?('api/v1/')
    end.uniq
    covered = open_routes.keys + refused.keys + listed.keys + created.keys

    expect(routes - covered).to be_empty, "Routes with no tenant case: #{routes - covered}"
    expect(covered - routes).to be_empty, "Cases for routes that no longer exist: #{covered - routes}"
  end

  describe "company A's records, called by company B" do
    refused.each do |route, request|
      it "#{route} answers 404 and changes nothing" do
        verb, path, body = instance_exec(&request)

        expect { call_as_b(verb, path, body) }.not_to(change { company_a_data })
        expect(response).to have_http_status(:not_found)
      end
    end
  end

  describe 'lists' do
    listed.each do |route, path|
      it "#{route} leaves company A out" do
        own = create(route.include?('assessments') ? :assessment : :vacancy, organization: company_b)

        call_as_b(:get, path)

        expect(response).to have_http_status(:ok)
        expect(response.parsed_body.values.first.pluck('id')).to eq([own.id])
      end
    end
  end

  describe 'creates' do
    created.each do |route, (path, model, body)|
      it "#{route} lands in company B even when the body names company A" do
        planted = body.transform_values { _1.merge(tenant_id: company_a.id) }

        expect { call_as_b(:post, path, planted) }.not_to(change { company_a_data.first(9) })

        expect(response).to have_http_status(:created)
        expect(model.unscoped.order(:id).last.tenant_id).to eq(company_b.id)
      end
    end
  end

  describe "company B's own records, with company A's IDs in the body" do
    let(:assessment_b) { create(:assessment, organization: company_b) }
    let(:vacancy_b)    { create(:vacancy, organization: company_b) }
    let(:portfolio_b)  { create(:portfolio, session: create(:session, assessment: assessment_b)) }

    it "does not edit company A's assessment skill through B's assessment" do
      a_skill = assessment.assessment_skills.first
      body = { assessment: { assessment_skills_attributes: [{ id: a_skill.id, skill_label: 'Taken' }] } }

      expect { call_as_b(:patch, "/api/v1/assessments/#{assessment_b.id}", body) }.not_to(change { company_a_data })
      expect(response).to have_http_status(:not_found)
    end

    it "does not edit company A's vacancy skill through B's vacancy" do
      body = { vacancy: { vacancy_skills_attributes: [{ id: vacancy_skill.id, skill_label: 'Taken' }] } }

      expect { call_as_b(:patch, "/api/v1/vacancies/#{vacancy_b.id}", body) }.not_to(change { company_a_data })
      expect(response).to have_http_status(:not_found)
    end

    it "does not run fit/gap of B's candidate against A's vacancy" do
      expect { call_as_b(:post, "/api/v1/portfolios/#{portfolio_b.id}/fitgap", { vacancy_id: vacancy.id }) }
        .not_to(change { company_a_data })
      expect(response).to have_http_status(:not_found)
    end

    it "does not regenerate fit/gap of B's candidate against A's vacancy" do
      expect { call_as_b(:post, "/api/v1/portfolios/#{portfolio_b.id}/regenerate_fitgap", { vacancy_id: vacancy.id }) }
        .not_to(change { company_a_data })
      expect(response).to have_http_status(:not_found)
    end

    it "does not put A's vacancy into the PDF export of B's candidate" do
      allow(Exports::PdfGenerator).to receive(:new).and_call_original

      call_as_b(:get, "/api/v1/portfolios/#{portfolio_b.id}/export", { format: 'pdf', vacancy_id: vacancy.id })

      expect(response).to have_http_status(:ok)
      expect(Exports::PdfGenerator).to have_received(:new).with(portfolio: portfolio_b, vacancy: nil)
    end
  end

  describe 'signing in (C2)' do
    it 'does not let a user pick the company they sign in to' do
      pending 'C2: login takes the company from the X-Tenant-Scheme header, and users belong to no company'
      user = create(:user)

      login_headers = { 'Content-Type' => 'application/json', 'X-Tenant-Scheme' => company_a.scheme }
      post '/api/v1/auth/login', params: { email: user.email, password: 'correct-horse-battery' }.to_json,
                                 headers: login_headers
      token = response.parsed_body['token']
      get "/api/v1/assessments/#{assessment.id}", headers: { 'Authorization' => "Bearer #{token}" }

      expect(response).to have_http_status(:not_found)
    end
  end
end
