# frozen_string_literal: true

require 'rails_helper'

# The product produced a rating and then stopped. What happened to the candidate
# lived in somebody's spreadsheet, so the one question asked afterwards, "why
# was this person rejected", had no answer inside the system that produced the
# reason.
RSpec.describe 'Hiring decisions', type: :request do
  let(:org)        { TenantContext.organization }
  let(:assessment) { create(:assessment, :with_prd02_skills) }
  let(:session)    { create(:session, :ended, assessment: assessment) }
  let(:portfolio)  { create(:portfolio, session: session) }

  let!(:react) do
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 4, ai_confidence: 'medium')
  end
  let!(:unrated) do
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'System Design', ai_level: nil, ai_confidence: 'low')
  end

  def headers_for(o = org)
    {
      'Authorization'   => "Bearer #{JsonWebToken.encode(user_id: 1, role: 'admin', scheme: o.scheme)}",
      'X-Tenant-Scheme' => o.scheme,
      'CONTENT_TYPE'    => 'application/json'
    }
  end

  def body = JSON.parse(response.body).fetch('data', JSON.parse(response.body))

  let(:rationale) { 'Strong frontend depth, but system design was never covered in the interview.' }
  let(:payload)   { { hiring_decision: { decision: 'hold', rationale: rationale } }.to_json }

  def post_decision(params = payload, org_for: org)
    post "/api/v1/portfolios/#{portfolio.id}/hiring_decision", params: params, headers: headers_for(org_for)
  end

  describe 'recording a decision' do
    it 'stores what was decided and why' do
      post_decision

      expect(response).to have_http_status(:created)
      expect(body.dig('hiring_decision', 'decision')).to eq('hold')
      expect(body.dig('hiring_decision', 'rationale')).to eq(rationale)
    end

    it 'records who decided, and when' do
      post_decision

      decision = portfolio.reload.hiring_decision
      expect(decision.decided_by).to eq(1)
      expect(decision.decided_at).to be_present
    end

    it 'refuses a decision outside the three that exist' do
      post_decision({ hiring_decision: { decision: 'maybe later', rationale: rationale } }.to_json)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(portfolio.reload.hiring_decision).to be_nil
    end

    # "Good fit" is not an explanation a rejected candidate could ever be shown.
    it 'refuses a rationale too short to have said anything' do
      post_decision({ hiring_decision: { decision: 'reject', rationale: 'not a fit' } }.to_json)

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it 'refuses a rationale that is only whitespace' do
      post_decision({ hiring_decision: { decision: 'reject', rationale: ' ' * 40 } }.to_json)

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  # This is the part that makes the record an audit trail rather than a foreign
  # key. Regenerating a portfolio destroys and rewrites its skills, and the
  # assessor overrides attached to them, so a decision that only pointed at the
  # portfolio would change meaning afterwards without anyone touching it.
  describe 'the snapshot of what was on screen' do
    it 'freezes the levels the decision was made on' do
      post_decision

      snapshot = portfolio.reload.hiring_decision.levels_at_decision
      expect(snapshot.dig('React', 'effective_level')).to eq(4)
    end

    it 'records an assessor override as the effective level, and says a human set it' do
      create(:assessor_override, portfolio_skill: react, ai_level: 4, override_level: 2)

      post_decision

      snapshot = portfolio.reload.hiring_decision.levels_at_decision
      expect(snapshot.dig('React', 'effective_level')).to eq(2)
      expect(snapshot.dig('React', 'ai_level')).to eq(4)
      expect(snapshot.dig('React', 'overridden')).to be true
    end

    # The skill nobody assessed is part of the picture the decision was made on,
    # and the part most likely to be forgotten afterwards.
    it 'remembers which skills had no rating at all' do
      post_decision

      snapshot = portfolio.reload.hiring_decision.levels_at_decision
      expect(snapshot.dig('System Design', 'assessed')).to be false
      expect(snapshot.dig('System Design', 'effective_level')).to be_nil
    end

    it 'survives the portfolio being regenerated underneath it' do
      post_decision
      before_snapshot = portfolio.reload.hiring_decision.levels_at_decision

      portfolio.portfolio_skills.destroy_all
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'React', ai_level: 1)

      expect(portfolio.reload.hiring_decision.levels_at_decision).to eq(before_snapshot)
    end
  end

  describe 'a decision that already exists' do
    before { post_decision }

    it 'is reported as a conflict rather than overwritten' do
      post_decision({ hiring_decision: { decision: 'reject', rationale: rationale } }.to_json)

      expect(response).to have_http_status(:conflict)
    end

    it 'shows what was decided instead of silently discarding it' do
      post_decision({ hiring_decision: { decision: 'reject', rationale: rationale } }.to_json)

      expect(body.dig('hiring_decision', 'decision')).to eq('hold')
    end

    it 'leaves exactly one decision on the record' do
      2.times { post_decision }

      expect(HiringDecision.where(portfolio_id: portfolio.id).count).to eq(1)
    end

    # An audit trail that can be quietly edited is not one.
    it 'cannot be edited afterwards, even from inside the app' do
      decision = portfolio.reload.hiring_decision

      expect { decision.update!(rationale: 'Rewriting history, quietly.') }
        .to raise_error(ActiveRecord::ReadOnlyRecord)
    end
  end

  describe 'reading a decision back' do
    it 'returns null when nobody has decided yet' do
      get "/api/v1/portfolios/#{portfolio.id}/hiring_decision", headers: headers_for

      expect(response).to have_http_status(:ok)
      expect(body['hiring_decision']).to be_nil
    end

    it 'returns the decision once one exists' do
      post_decision

      get "/api/v1/portfolios/#{portfolio.id}/hiring_decision", headers: headers_for

      expect(body.dig('hiring_decision', 'decision')).to eq('hold')
    end
  end

  describe 'across a tenant boundary' do
    let(:other_org) do
      Organization.find_by(scheme: 'other-corp') || Organization.create!(
        name: 'Other Corp', scheme: 'other-corp', identifier: 'other-corp', host: 'other.test'
      )
    end

    it 'cannot be recorded by another customer' do
      post_decision(payload, org_for: other_org)

      expect(response).to have_http_status(:not_found)
      expect(portfolio.reload.hiring_decision).to be_nil
    end

    it 'cannot be read by another customer' do
      post_decision

      get "/api/v1/portfolios/#{portfolio.id}/hiring_decision", headers: headers_for(other_org)

      expect(response).to have_http_status(:not_found)
    end
  end
end
