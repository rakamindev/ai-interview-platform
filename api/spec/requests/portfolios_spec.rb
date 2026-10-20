# frozen_string_literal: true

require 'rails_helper'

# What the portfolio endpoints send once "not assessed" is a real state (Step 4, Option B).
RSpec.describe 'Portfolios', type: :request do
  let(:organization) { create(:organization) }
  let(:assessment)   { create(:assessment, organization:) }
  let(:session)      { create(:session, :ended, assessment:) }
  let(:portfolio)    { create(:portfolio, session:) }
  let(:headers)      { auth_headers_for(organization) }

  let!(:rated) { create(:portfolio_skill, portfolio:, skill_label: 'React', ai_level: 3) }
  # Created inside each example (after `pending`) while the not-assessed columns don't exist yet.
  let(:unrated) do
    create(:portfolio_skill, portfolio:, skill_label: 'Communication', ai_level: nil, ai_confidence: nil,
                             competency_summary: nil, evidence: [], not_assessed_reason: 'not_reached')
  end

  def skills = json.dig('portfolio', 'skills').index_by { _1['skill_label'] }
  def json = response.parsed_body

  it 'AC-19: says for each skill whether it was assessed, and why not' do
    unrated
    get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

    expect(skills['React']).to include('ai_level' => 3, 'assessment_status' => 'assessed', 'not_assessed_reason' => nil)
    expect(skills['Communication']).to include('ai_level' => nil, 'ai_confidence' => nil,
                                               'assessment_status' => 'not_assessed',
                                               'not_assessed_reason' => 'not_reached')
  end

  describe 'rating a skill the AI did not rate (AC-20)' do
    def rate(notes)
      post "/api/v1/portfolio_skills/#{unrated.id}/override",
           params: { override: { override_level: 3, assessor_notes: notes } }.to_json, headers:
    end

    it 'saves it with no AI level underneath' do
      rate('Probed in the second interview')

      expect(response).to have_http_status(:created)
      expect(json['override']).to include('ai_level' => nil, 'override_level' => 3)
    end

    it 'refuses it without a note' do
      rate('')

      expect(response).to have_http_status(:unprocessable_entity)
      expect(unrated.reload.assessor_override).to be_nil
    end
  end

  describe 'a failed portfolio (AC-21)' do
    def fail_portfolio
      portfolio.update!(generation_status: 'failed', generation_error_category: 'model_invalid_response',
                        generation_error: "unexpected token at 'Here is the portfolio for Budi Santoso'")
    end

    it 'sends the category and a safe message, never the stored error text' do
      fail_portfolio
      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      expect(json.dig('portfolio', 'generation_error_category')).to eq('model_invalid_response')
      expect(json['error']).to eq("The AI's answer couldn't be read as a portfolio.")
      expect(response.body).not_to include('Budi')
    end

    it 'sends a generic message for a failure stored before categories existed' do
      fail_portfolio
      portfolio.update!(generation_error_category: nil)

      get "/api/v1/sessions/#{session.id}/portfolio", headers: headers

      expect(json['error']).to eq('Generating the portfolio failed.')
      expect(response.body).not_to include('Budi')
    end
  end
end
