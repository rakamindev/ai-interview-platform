# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Portfolios API', type: :request do
  let(:acme)  { create_organization('acme') }
  let(:rival) { create_organization('rival') }

  let(:session_record) do
    as_tenant(acme) { create(:session, assessment: create(:assessment)) }
  end
  let(:portfolio) { create(:portfolio, session: session_record) }
  let!(:assessed) { create(:portfolio_skill, portfolio:, skill_label: 'React', evidence: ['quote'], evidence_refs: [{ quote: 'quote', turn_number: 4 }]) }
  let!(:skipped)  { create(:portfolio_skill, :not_assessed, portfolio:, skill_label: 'System Design') }
  let(:vacancy)   { as_tenant(acme) { create(:vacancy) } }

  def json = JSON.parse(response.body)

  describe 'tenant isolation (UU PDP: candidate data must not cross companies)' do
    let!(:report) { FitGapReport.create!(portfolio:, vacancy:, skill_comparisons: [{ skill_label: 'React' }]) }

    {
      'GET export (json)'         => [:get,  ->(p, _v) { "/api/v1/portfolios/#{p.id}/export?format=json" }],
      'GET export (pdf)'          => [:get,  ->(p, _v) { "/api/v1/portfolios/#{p.id}/export?format=pdf" }],
      'GET fit/gap report'        => [:get,  ->(p, v) { "/api/v1/portfolios/#{p.id}/fitgap/#{v.id}" }],
      'POST fit/gap'              => [:post, ->(p, _v) { "/api/v1/portfolios/#{p.id}/fitgap" }],
      'POST regenerate fit/gap'   => [:post, ->(p, _v) { "/api/v1/portfolios/#{p.id}/regenerate_fitgap" }],
      'GET session portfolio'     => [:get,  ->(p, _v) { "/api/v1/sessions/#{p.session_id}/portfolio" }]
    }.each do |name, (verb, path)|
      it "#{name} returns 404 to another tenant and leaks nothing" do
        public_send(verb, path.call(portfolio, vacancy), params: { vacancy_id: vacancy.id }.to_json,
                                                         headers: auth_headers(rival))

        expect(response).to have_http_status(:not_found)
        expect(response.body).not_to include('React', 'quote')
      end
    end

    # The vacancy lookup is tenant-scoped, so using acme's vacancy id 404s even on
    # the old code. The real attack is pairing acme's portfolio with the
    # attacker's own vacancy, which used to queue a report built from acme data.
    %w[fitgap regenerate_fitgap].each do |action|
      it "POST #{action} cannot pair another tenant’s portfolio with the caller’s own vacancy" do
        rival_vacancy = as_tenant(rival) { create(:vacancy) }

        post "/api/v1/portfolios/#{portfolio.id}/#{action}", params: { vacancy_id: rival_vacancy.id }.to_json,
                                                              headers: auth_headers(rival)

        expect(response).to have_http_status(:not_found)
        expect(FitGapGeneratorWorker.jobs).to be_empty
      end
    end

    it 'blocks overriding another tenant’s portfolio skill' do
      post "/api/v1/portfolio_skills/#{assessed.id}/override",
           params: { override: { override_level: 5, assessor_notes: 'x' } }.to_json, headers: auth_headers(rival)

      expect(response).to have_http_status(:not_found)
      expect(assessed.reload.assessor_override).to be_nil
    end

    it 'still serves the owning tenant' do
      get "/api/v1/portfolios/#{portfolio.id}/fitgap/#{vacancy.id}", headers: auth_headers(acme)
      expect(response).to have_http_status(:ok)
    end

    it 'rejects requests without a token' do
      get "/api/v1/portfolios/#{portfolio.id}/export?format=json", headers: { 'X-Tenant-Scheme' => 'acme' }
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe 'GET /api/v1/sessions/:id/portfolio' do
    it 'exposes assessment status, provenance and verified evidence for each skill' do
      get "/api/v1/sessions/#{session_record.id}/portfolio", headers: auth_headers(acme)

      skills = json.dig('portfolio', 'skills')
      expect(skills.map { |s| s.slice('skill_label', 'assessment_status', 'ai_level') }).to eq([
        { 'skill_label' => 'React', 'assessment_status' => 'assessed', 'ai_level' => 3 },
        { 'skill_label' => 'System Design', 'assessment_status' => 'not_assessed', 'ai_level' => nil }
      ])
      expect(skills.first['evidence_refs']).to eq([{ 'quote' => 'quote', 'turn_number' => 4 }])
      expect(skills.last['status_reason']).to eq('never_reached')
    end

    it 'does not show a stale error on a complete portfolio' do
      portfolio.update!(generation_error: 'old failure')
      get "/api/v1/sessions/#{session_record.id}/portfolio", headers: auth_headers(acme)
      expect(json.dig('portfolio', 'generation_error')).to be_nil
    end

    it 'reports generating while the job runs' do
      portfolio.update!(generation_status: 'generating')
      get "/api/v1/sessions/#{session_record.id}/portfolio", headers: auth_headers(acme)
      expect(response).to have_http_status(:accepted)
    end
  end

  describe 'POST /api/v1/sessions/:id/portfolio/regenerate' do
    let(:path) { "/api/v1/sessions/#{session_record.id}/portfolio/regenerate" }

    it 'queues exactly one job for a failed portfolio' do
      portfolio.update!(generation_status: 'failed', generation_error: 'The AI model took too long to respond.')

      expect { post path, headers: auth_headers(acme) }.to change(PortfolioGeneratorWorker.jobs, :size).by(1)
      expect(portfolio.reload).to have_attributes(generation_status: 'pending', generation_error: nil)
    end

    it 'allows recovering a portfolio stuck in generating' do
      portfolio.update!(generation_status: 'generating', generation_started_at: 1.hour.ago)
      post path, headers: auth_headers(acme)
      expect(response).to have_http_status(:ok)
    end

    it 'refuses to regenerate a portfolio that is still fresh in generation or complete' do
      portfolio.update!(generation_status: 'generating', generation_started_at: 1.minute.ago)
      post path, headers: auth_headers(acme)
      expect(response).to have_http_status(:unprocessable_entity)

      portfolio.update!(generation_status: 'complete')
      post path, headers: auth_headers(acme)
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    def override(skill, attrs)
      post "/api/v1/portfolio_skills/#{skill.id}/override", params: { override: attrs }.to_json, headers: auth_headers(acme)
    end

    it 'requires a note when rating a skill the AI did not assess' do
      override(skipped, override_level: 3)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json.dig('errors', 0, 'message')).to match(/note is required/)

      override(skipped, override_level: 3, assessor_notes: 'Covered in a follow-up call')
      expect(response).to have_http_status(:created)
      expect(skipped.reload.assessor_override).to have_attributes(ai_level: nil, override_level: 3)
    end

    it 'validates the level and note length' do
      override(assessed, override_level: 9)
      expect(response).to have_http_status(:unprocessable_entity)

      override(assessed, override_level: 2, assessor_notes: 'x' * 2_001)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'queues regeneration of fit/gap reports that used the old level' do
      FitGapReport.create!(portfolio:, vacancy:, skill_comparisons: [{ skill_label: 'React' }])

      expect { override(assessed, override_level: 4) }.to change(FitGapGeneratorWorker.jobs, :size).by(1)
      expect(FitGapReport.where(portfolio:)).to be_empty
    end
  end
end
