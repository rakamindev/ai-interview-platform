# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::ReportPresenter do
  let(:interview) { create(:session, duration_seconds: 2280, end_reason: 'all_covered') }

  def report(status, **attrs)
    create(:portfolio, session: interview, generation_status: status, **attrs)
  end

  def rated(portfolio, status = 'assessed', **attrs)
    create(:portfolio_skill, portfolio: portfolio, status: status, **attrs)
  end

  def absent(portfolio, status = 'not_assessed', **attrs)
    create(:portfolio_skill, portfolio: portfolio, status: status, ai_level: nil, ai_confidence: nil,
                             competency_summary: nil, **attrs)
  end

  def json_for(portfolio)
    described_class.new(portfolio).as_json
  end

  describe 'state' do
    it 'is pending while the job has not started' do
      expect(json_for(report('pending'))[:state]).to eq('pending')
    end

    it 'is generating while the job runs, or while a retry waits after a failed try' do
      expect(json_for(report('generating'))[:state]).to eq('generating')
      expect(json_for(create(:portfolio, generation_status: 'pending', failure_kind: 'model_unavailable'))[:state])
        .to eq('generating')
    end

    it 'is stalled after 5 minutes without progress, and can be tried again' do
      portfolio = report('generating')
      portfolio.update_column(:status_changed_at, 6.minutes.ago)

      json = json_for(portfolio)
      expect(json).to include(state: 'stalled', can_retry: true)
      expect(json[:failure]).to include(kind: 'worker_lost', retryable: true)
    end

    it 'is complete when every configured skill is accounted for, even as not assessed' do
      portfolio = report('complete')
      rated(portfolio)
      absent(portfolio, 'not_assessed')

      expect(json_for(portfolio)[:state]).to eq('complete')
    end

    it 'is partial when a configured skill could not be evaluated' do
      portfolio = report('complete')
      rated(portfolio)
      absent(portfolio, 'unavailable')

      expect(json_for(portfolio)[:state]).to eq('partial')
    end

    it 'is empty when the report has no configured skills' do
      portfolio = report('complete')
      rated(portfolio, is_discovered: true)

      expect(json_for(portfolio)[:state]).to eq('empty')
    end
  end

  describe 'failure' do
    it 'is null while nothing went wrong' do
      expect(json_for(report('generating'))[:failure]).to be_nil
    end

    it 'names the kind and when it happened, and whether trying again can help' do
      portfolio = report('failed', failure_kind: 'model_response_invalid')

      expect(json_for(portfolio)[:failure])
        .to eq(kind: 'model_response_invalid', occurred_at: portfolio.status_changed_at, retryable: true)
    end

    it 'says an interview without data cannot be tried again' do
      json = json_for(report('failed', failure_kind: 'no_interview_data'))

      expect(json[:failure]).to include(kind: 'no_interview_data', retryable: false)
      expect(json[:can_retry]).to be(false)
    end

    it 'shows an error on our side as a stopped job that can be tried again' do
      expect(json_for(report('failed', failure_kind: nil))[:failure]).to include(kind: 'worker_lost', retryable: true)
    end

    it 'never sends the raw error text' do
      json = json_for(report('failed', failure_kind: 'model_unavailable', generation_error: 'API returned 503'))

      expect(json).not_to have_key(:generation_error)
      expect(json.to_json).not_to include('API returned 503')
    end
  end

  describe 'can_retry' do
    it 'allows a partial report to be generated again while nobody has reviewed it' do
      portfolio = report('complete')
      absent(portfolio, 'unavailable')

      expect(json_for(portfolio)[:can_retry]).to be(true)
    end

    it 'never offers it when a review would be lost' do
      portfolio = report('complete')
      reviewed = rated(portfolio, ai_level: 3)
      absent(portfolio, 'unavailable')
      AssessorOverride.create!(portfolio_skill: reviewed, ai_level: 3, override_level: 4, overridden_by: 1)

      expect(json_for(portfolio)[:can_retry]).to be(false)
    end

    it 'never offers it for a complete report or a running job' do
      portfolio = report('complete')
      rated(portfolio)

      expect(json_for(portfolio)[:can_retry]).to be(false)
      expect(json_for(create(:portfolio, generation_status: 'generating'))[:can_retry]).to be(false)
    end
  end

  describe 'skills' do
    it 'never show a level, confidence, quotes or summary for an absent skill, even from an older row' do
      portfolio = report('complete')
      create(:portfolio_skill, portfolio: portfolio, status: 'not_assessed', ai_level: 1, ai_confidence: 'low',
                               evidence: ['An old quote.'], competency_summary: 'An old guess.')

      expect(json_for(portfolio)[:skills].first)
        .to include(status: 'not_assessed', ai_level: nil, ai_confidence: nil, caveat: nil,
                    evidence: [], competency_summary: nil, anchor: nil)
    end

    it "show the assessment's own description of the level given, matched by skill id" do
      create(:assessment_skill, assessment: interview.assessment, skill_id: 'SK-ENG-001', skill_label: 'React',
                                l3_anchor: 'Handles complex work and explains trade-offs.')
      portfolio = report('complete')
      rated(portfolio, skill_id: 'sk-eng-001', skill_label: 'React / Frontend', ai_level: 3)

      expect(json_for(portfolio)[:skills].first[:anchor]).to eq('Handles complex work and explains trade-offs.')
    end

    it 'match the description by name when there is no skill id' do
      create(:assessment_skill, assessment: interview.assessment, skill_label: 'System Design',
                                l2_anchor: 'Designs routine services alone.')
      portfolio = report('complete')
      rated(portfolio, skill_label: 'system design', ai_level: 2)

      expect(json_for(portfolio)[:skills].first[:anchor]).to eq('Designs routine services alone.')
    end

    it 'keep the raw level for operators only' do
      portfolio = report('complete')
      absent(portfolio, 'unavailable', raw_level: '"strong"')

      expect(json_for(portfolio)[:skills].first).not_to have_key(:raw_level)
    end

    it 'are not sent until the report is ready' do
      portfolio = report('generating')
      rated(portfolio)

      expect(json_for(portfolio)[:skills]).to eq([])
    end
  end

  describe 'summary' do
    it 'counts configured skills by status, and discovered skills apart' do
      portfolio = report('complete')
      rated(portfolio, 'assessed')
      rated(portfolio, 'thin_evidence', caveat: 'low_probe_count')
      absent(portfolio, 'not_assessed')
      rated(portfolio, 'assessed', is_discovered: true)

      expect(json_for(portfolio)[:summary])
        .to include(assessed: 1, thin_evidence: 1, not_assessed: 1, unavailable: 0, discovered: 1)
    end

    it 'has no counts before a report exists' do
      expect(json_for(report('pending'))[:summary])
        .to include(assessed: nil, thin_evidence: nil, not_assessed: nil, unavailable: nil, discovered: nil)
    end

    it 'says what the interview rests on' do
      create_list(:coverage_map, 3, session: interview)
      create(:coverage_map, session: interview, is_discovered: true)
      create_list(:transcript_turn, 4, session: interview)

      expect(json_for(report('pending'))[:summary])
        .to include(total_skills: 3, turns: 4, duration_seconds: 2280, end_reason: 'all_covered')
    end

    it "counts the assessment's skills when the interview never started" do
      create_list(:assessment_skill, 2, assessment: interview.assessment)

      expect(json_for(report('failed', failure_kind: 'no_interview_data'))[:summary][:total_skills]).to eq(2)
    end
  end
end
