# frozen_string_literal: true

require 'rails_helper'

# AC-60 / AC-61: every portfolio, fit/gap, export and override endpoint must
# behave as if another organisation's records do not exist (404), without
# writing data or enqueueing jobs. Each endpoint also gets an owner control
# request so a wrong route cannot make the 404 pass by accident.
RSpec.describe 'Tenant isolation for portfolio endpoints' do
  let(:org_a) { create(:organization) }
  let(:org_b) { create(:organization) }

  let(:session_a)   { create(:session, assessment: create(:assessment, organization: org_a)) }
  let!(:portfolio_a) { create(:portfolio, session: session_a) }
  let!(:skill_a)     { create(:portfolio_skill, portfolio: portfolio_a, skill_label: 'Ruby on Rails', ai_level: 3) }
  let!(:vacancy_a)   { create(:vacancy, organization: org_a) }
  let!(:report_a)    { create(:fit_gap_report, portfolio: portfolio_a, vacancy: vacancy_a) }
  let!(:vacancy_b)   { create(:vacancy, organization: org_b) }

  let(:owner_headers)    { auth_headers_for(org_a) }
  let(:intruder_headers) { auth_headers_for(org_b, user_id: 99) }

  before { create(:vacancy_skill, vacancy: vacancy_a, skill_label: 'Ruby on Rails', expected_level: 3) }

  def perform(method, path, headers, params = nil)
    send(method, path, params: params&.to_json, headers: headers.merge('Content-Type' => 'application/json'))
  end

  # Everything an intruder request could write: reports, overrides, portfolio state.
  def snapshot
    {
      reports: FitGapReport.order(:id).pluck(:id, :portfolio_id, :vacancy_id, :generated_at),
      overrides: AssessorOverride.order(:id).pluck(:id, :portfolio_skill_id, :override_level, :assessor_notes),
      override_events: AssessorOverrideEvent.count,
      portfolio_status: portfolio_a.reload.generation_status
    }
  end

  shared_examples 'hidden from other organisations' do |method, path_proc, params_proc = nil|
    it 'returns 404 for another organisation without side effects' do
      path   = instance_exec(&path_proc)
      params = params_proc && instance_exec(&params_proc)
      before_state = snapshot

      perform(method, path, intruder_headers, params)

      expect(response).to have_http_status(:not_found)
      expect(snapshot).to eq(before_state)
      expect(Sidekiq::Worker.jobs).to be_empty
    end

    it 'is reachable by the owning organisation' do
      path   = instance_exec(&path_proc)
      params = params_proc && instance_exec(&params_proc)

      perform(method, path, owner_headers, params)

      expect(response).not_to have_http_status(:not_found)
    end
  end

  describe 'GET /api/v1/sessions/:id/portfolio' do
    include_examples 'hidden from other organisations', :get,
                     -> { "/api/v1/sessions/#{session_a.id}/portfolio" }
  end

  describe 'POST /api/v1/sessions/:id/portfolio/regenerate' do
    include_examples 'hidden from other organisations', :post,
                     -> { "/api/v1/sessions/#{session_a.id}/portfolio/regenerate" }
  end

  describe 'GET /api/v1/portfolios/:id/fitgap/:vacancy_id' do
    include_examples 'hidden from other organisations', :get,
                     -> { "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy_a.id}" }
  end

  describe 'POST /api/v1/portfolios/:id/fitgap' do
    include_examples 'hidden from other organisations', :post,
                     -> { "/api/v1/portfolios/#{portfolio_a.id}/fitgap" },
                     -> { { fitgap: { vacancy_id: vacancy_a.id } } }
  end

  describe 'POST /api/v1/portfolios/:id/regenerate_fitgap' do
    include_examples 'hidden from other organisations', :post,
                     -> { "/api/v1/portfolios/#{portfolio_a.id}/regenerate_fitgap" },
                     -> { { vacancy_id: vacancy_a.id } }
  end

  describe 'GET /api/v1/portfolios/:id/export (json)' do
    include_examples 'hidden from other organisations', :get,
                     -> { "/api/v1/portfolios/#{portfolio_a.id}/export?format=json&vacancy_id=#{vacancy_a.id}" }
  end

  describe 'GET /api/v1/portfolios/:id/export (pdf)' do
    include_examples 'hidden from other organisations', :get,
                     -> { "/api/v1/portfolios/#{portfolio_a.id}/export?format=pdf&vacancy_id=#{vacancy_a.id}" }
  end

  describe 'POST /api/v1/portfolio_skills/:id/override' do
    include_examples 'hidden from other organisations', :post,
                     -> { "/api/v1/portfolio_skills/#{skill_a.id}/override" },
                     -> { { override: { override_level: 4, assessor_notes: 'Contoh catatan.' } } }
  end

  describe 'DELETE /api/v1/portfolio_skills/:id/override' do
    before do
      skill_a.create_assessor_override!(ai_level: 3, override_level: 4, assessor_notes: 'Contoh catatan.',
                                        overridden_by: 1, overridden_at: Time.current)
    end

    include_examples 'hidden from other organisations', :delete,
                     -> { "/api/v1/portfolio_skills/#{skill_a.id}/override" },
                     -> { { notes: 'Contoh catatan revert.' } }
  end

  describe 'GET /api/v1/portfolio_skills/:id/override_events' do
    include_examples 'hidden from other organisations', :get,
                     -> { "/api/v1/portfolio_skills/#{skill_a.id}/override_events" }
  end

  describe 'POST /api/v1/portfolio_skills/:id/confirm' do
    include_examples 'hidden from other organisations', :post,
                     -> { "/api/v1/portfolio_skills/#{skill_a.id}/confirm" },
                     -> { { notes: 'Contoh konfirmasi.' } }
  end

  describe 'intruder pairing their own vacancy with another organisation portfolio' do
    it 'POST fitgap returns 404 and enqueues nothing' do
      perform(:post, "/api/v1/portfolios/#{portfolio_a.id}/fitgap", intruder_headers,
              { fitgap: { vacancy_id: vacancy_b.id } })

      expect(response).to have_http_status(:not_found)
      expect(Sidekiq::Worker.jobs).to be_empty
    end

    it 'POST regenerate_fitgap returns 404 and enqueues nothing' do
      perform(:post, "/api/v1/portfolios/#{portfolio_a.id}/regenerate_fitgap", intruder_headers,
              { vacancy_id: vacancy_b.id })

      expect(response).to have_http_status(:not_found)
      expect(Sidekiq::Worker.jobs).to be_empty
    end
  end

  describe 'cross-tenant vacancy (AC-61)' do
    it 'does not let an owner pair their portfolio with another organisation vacancy' do
      perform(:post, "/api/v1/portfolios/#{portfolio_a.id}/fitgap", owner_headers,
              { fitgap: { vacancy_id: vacancy_b.id } })

      expect(response).to have_http_status(:not_found)
      expect(Sidekiq::Worker.jobs).to be_empty
    end

    it 'does not export a report paired with another organisation vacancy' do
      create(:fit_gap_report, portfolio: portfolio_a, vacancy: vacancy_b)

      perform(:get, "/api/v1/portfolios/#{portfolio_a.id}/export?format=json&vacancy_id=#{vacancy_b.id}",
              owner_headers)

      expect(response.parsed_body['fit_gap_report']).to be_nil
    end

    it 'does not render another organisation vacancy into the PDF export' do
      create(:fit_gap_report, portfolio: portfolio_a, vacancy: vacancy_b)
      allow(Exports::PdfGenerator).to receive(:new).and_call_original

      perform(:get, "/api/v1/portfolios/#{portfolio_a.id}/export?format=pdf&vacancy_id=#{vacancy_b.id}",
              owner_headers)

      expect(response).to have_http_status(:ok)
      expect(Exports::PdfGenerator).to have_received(:new).with(portfolio: portfolio_a, vacancy: nil)
    end

    it 'does not show a report paired with another organisation vacancy' do
      create(:fit_gap_report, portfolio: portfolio_a, vacancy: vacancy_b)

      perform(:get, "/api/v1/portfolios/#{portfolio_a.id}/fitgap/#{vacancy_b.id}", owner_headers)

      expect(response).to have_http_status(:not_found)
    end
  end
end
