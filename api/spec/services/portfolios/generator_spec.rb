# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  # Explicit, not metadata-triggered: this must register before the let!s
  # below run, and relying on :with_tenant + apply_to_host_groups timing was
  # not reliably doing that (Current.tenant_id was unset when the coverage_map
  # factories fired). include_context here is unambiguous about ordering.
  include_context 'with tenant'

  let(:assessment) { create(:assessment) }
  let(:session)    { create(:session, :ended, assessment: assessment) }

  # 'Incident Response' is the skill nobody asked about. It is the entire point
  # of this file: under the old implementation it arrived in a hiring report as
  # L1 — the lowest possible rating — because `nil.to_i.clamp(1, 5)` is 1.
  let!(:probed) do
    create(:coverage_map, session: session, skill_id: 'sk-eng-001',
                          skill_label: 'Distributed Systems', state: 'covered', probe_count: 3)
  end
  let!(:unprobed) do
    create(:coverage_map, :not_probed, session: session, skill_id: 'sk-eng-002',
                                       skill_label: 'Incident Response')
  end

  before { create_list(:transcript_turn, 4, session: session) }

  def generate(mode = :happy, payload: nil)
    described_class.new(session: session, gemini_client: stub_gemini(mode, payload: payload)).call
  end

  def skill(portfolio, label) = portfolio.portfolio_skills.find_by(skill_label: label)

  describe 'a skill that was never probed' do
    it 'is recorded as not_probed with no level, and never as L1' do
      result = skill(generate, 'Incident Response')

      expect(result.assessment_state).to eq('not_probed')
      expect(result.ai_level).to be_nil
      expect(result.ai_confidence).to be_nil

      # Stated explicitly because this exact value is the regression: a level of
      # 1 here is a candidate documented as deficient at something never asked.
      expect(result.ai_level).not_to eq(1)
    end

    it 'explains the absence rather than leaving the summary blank' do
      expect(skill(generate, 'Incident Response').competency_summary)
        .to include('not raised during this interview')
    end

    it 'refuses a rating even when the model supplies one anyway' do
      insistent = {
        'configured_skills' => [
          { 'skill_id' => 'sk-eng-002', 'skill_label' => 'Incident Response', 'level' => 4,
            'confidence' => 'high', 'evidence' => ['fabricated'], 'competency_summary' => 'Strong.' }
        ],
        'discovered_skills' => []
      }

      result = skill(generate(:happy, payload: insistent), 'Incident Response')

      expect(result.assessment_state).to eq('not_probed')
      expect(result.ai_level).to be_nil
    end
  end

  describe 'unusable levels from the model' do
    {
      missing_level: 'omits the level key',
      null_level:    'returns a null level',
      out_of_range:  'returns a level outside 1..5'
    }.each do |mode, description|
      it "records insufficient_evidence when the model #{description}, rather than coercing" do
        result = skill(generate(mode), 'Distributed Systems')

        expect(result.assessment_state).to eq('insufficient_evidence')
        expect(result.ai_level).to be_nil
      end
    end

    it 'accepts the unambiguous "L3" string form' do
      result = skill(generate(:string_level), 'Distributed Systems')

      expect(result.assessment_state).to eq('assessed')
      expect(result.ai_level).to eq(3)
    end
  end

  describe 'other malformed model output' do
    it 'downgrades an unrecognised confidence instead of trusting it' do
      expect(skill(generate(:invalid_confidence), 'Distributed Systems').ai_confidence).to eq('low')
    end

    it 'drops evidence returned as an object instead of persisting key/value pairs' do
      expect(skill(generate(:evidence_as_object), 'Distributed Systems').evidence).to eq([])
    end

    it 'drops a skill that is not in the session coverage map' do
      portfolio = generate(:unknown_skill)

      expect(portfolio.portfolio_skills.pluck(:skill_label)).not_to include('Skill Never Configured')
    end

    it 'does not create duplicate rows when the model repeats a skill' do
      portfolio = generate(:duplicate_skills)

      labels = portfolio.portfolio_skills.pluck(:skill_label)
      expect(labels).to eq(labels.uniq)
    end
  end

  describe 'assessor overrides' do
    it 'survives regeneration' do
      portfolio = generate
      rated     = skill(portfolio, 'Distributed Systems')
      override  = create(:assessor_override, portfolio_skill: rated, override_level: 5)

      generate

      expect(AssessorOverride.find_by(id: override.id)).to be_present
      expect(rated.reload.assessor_override.override_level).to eq(5)
    end

    it 'keeps the row id stable so the override stays attached' do
      portfolio = generate
      original_id = skill(portfolio, 'Distributed Systems').id

      generate

      expect(skill(portfolio.reload, 'Distributed Systems').id).to eq(original_id)
    end

    it 'keeps an overridden skill that leaves the coverage map, marked superseded' do
      portfolio = generate
      rated     = skill(portfolio, 'Distributed Systems')
      create(:assessor_override, portfolio_skill: rated)

      # The skill is no longer part of the session, so the contract stops
      # producing it. A human has rated it, so it must not vanish.
      probed.destroy!
      generate

      expect(rated.reload.superseded_at).to be_present
      expect(rated.assessor_override).to be_present
    end

    it 'removes a skill that leaves the coverage map when no human rated it' do
      portfolio = generate
      probed.destroy!

      generate

      expect(skill(portfolio.reload, 'Distributed Systems')).to be_nil
    end
  end

  describe 'write safety' do
    it 'rolls back completely when a write fails partway through', :truncation do
      allow_any_instance_of(PortfolioSkill).to receive(:save!).and_wrap_original do |original, *args, **kwargs|
        raise ActiveRecord::StatementInvalid, 'simulated write failure' if original.receiver.skill_label == 'Incident Response'

        original.call(*args, **kwargs)
      end

      expect { generate }.to raise_error(ActiveRecord::StatementInvalid)

      # Not "fewer than expected" — none. A half-written portfolio is a report
      # about a person with arbitrary skills missing from it.
      expect(PortfolioSkill.count).to eq(0)
      expect(session.reload.portfolio.generation_status).to eq('failed')
    end

    it 'is idempotent when the same job is delivered twice' do
      generate
      expect { generate }.not_to change { PortfolioSkill.count }
    end
  end

  describe 'model failures' do
    it 'marks the portfolio failed and re-raises on timeout' do
      expect { generate(:timeout) }.to raise_error(Gemini::HttpClient::TimeoutError)
      expect(session.reload.portfolio.generation_status).to eq('failed')
    end

    it 'marks the portfolio failed when the response is not JSON' do
      expect { generate(:malformed_json) }.to raise_error(described_class::EmptyResponseError)
      expect(session.reload.portfolio.generation_status).to eq('failed')
    end

    it 'does not write model output into the error column' do
      generate(:timeout)
    rescue Gemini::HttpClient::TimeoutError
      expect(session.reload.portfolio.generation_error).to start_with('Gemini::HttpClient::TimeoutError')
    end
  end
end
