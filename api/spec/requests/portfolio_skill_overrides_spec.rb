# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'POST /api/v1/portfolio_skills/:id/override' do
  let(:acme) { create_organization(scheme: 'acme') }
  let(:globex) { create_organization(scheme: 'globex') }
  let(:headers) { auth_headers_for(acme, user_id: 42) }

  let(:portfolio) { create(:portfolio, session: as_tenant(acme) { create(:session) }) }
  let!(:skill) { create(:portfolio_skill, portfolio:, ai_level: 2) }

  def override(skill_id, body)
    post "/api/v1/portfolio_skills/#{skill_id}/override", params: { override: body }.to_json, headers: headers
  end

  it 'saves an override with a reason and records who made it' do
    override(skill.id, override_level: 3, assessor_notes: 'Follow-up call covered this in depth.')

    expect(response).to have_http_status(:created)
    expect(skill.reload.assessor_override).to have_attributes(ai_level: 2, override_level: 3, overridden_by: 42)
  end

  it 'requires a reason (O1)' do
    override(skill.id, override_level: 3, assessor_notes: '  ')

    expect(response).to have_http_status(:unprocessable_entity)
    expect(skill.reload.assessor_override).to be_nil
  end

  it 'refuses to override a skill that was never rated (O2)' do
    unrated = create(:portfolio_skill, :not_assessed, portfolio:)

    override(unrated.id, override_level: 3, assessor_notes: 'I think they are fine')

    expect(response).to have_http_status(:unprocessable_entity)
    expect(response.parsed_body.dig('errors', 0, 'message')).to include('follow-up interview')
  end

  it 'rejects levels outside 1-5 (O3)' do
    override(skill.id, override_level: 6, assessor_notes: 'Exceptional')

    expect(response).to have_http_status(:unprocessable_entity)
  end

  it 'returns 404 for a skill in another organization (O4)' do
    other = create(:portfolio_skill, portfolio: create(:portfolio, session: as_tenant(globex) { create(:session) }))

    override(other.id, override_level: 5, assessor_notes: 'Trying to change another org')

    expect(response).to have_http_status(:not_found)
    expect(other.reload.assessor_override).to be_nil
  end

  it 'replaces existing fit/gap reports and queues them again (O5)' do
    vacancy = as_tenant(acme) { create(:vacancy) }
    FitGapReport.create!(portfolio:, vacancy:, skill_comparisons: [{ 'skill_label' => 'x' }])

    override(skill.id, override_level: 3, assessor_notes: 'Follow-up call covered this in depth.')

    expect(FitGapReport.where(portfolio:)).to be_empty
    expect(FitGapGeneratorWorker.jobs.map { |j| j['args'] }).to eq([[portfolio.id, vacancy.id]])
  end
end
