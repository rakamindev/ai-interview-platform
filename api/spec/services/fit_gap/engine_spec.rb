# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine, type: :service do
  include ActiveSupport::Testing::TimeHelpers
  # Stub out Gemini so tests never make real network calls
  let(:gemini_client) do
    instance_double(
      Gemini::HttpClient,
      generate_content: {
        'culture_narrative' => 'Good culture fit.',
        'overall_narrative' => 'Recommend proceeding.'
      }
    )
  end

  # Build a vacancy with one skill and a portfolio with a matching skill.
  let(:vacancy) do
    v = create(:vacancy)
    create(:vacancy_skill,
           vacancy:        v,
           skill_id:       'SK-ENG-001',
           skill_label:    'Ruby on Rails',
           expected_level: 3)
    v.reload
  end

  let(:session)   { create(:session) }
  let(:portfolio) { create(:portfolio, session: session) }

  subject(:engine) do
    described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini_client)
  end

  # ── Helper ─────────────────────────────────────────────────────────────────
  def run_engine
    engine.call
  end

  # ══════════════════════════════════════════════════════════════════════════
  # 1. Output keys
  # ══════════════════════════════════════════════════════════════════════════
  describe 'skill_comparisons output shape' do
    context 'when a matching portfolio skill exists (no override)' do
      before { create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-001', skill_label: 'Ruby on Rails', ai_level: 3, ai_confidence: 'high') }

      it 'uses required_level (not expected_level) as the key' do
        report = run_engine
        comparison = report.skill_comparisons.first
        expect(comparison).to have_key('required_level')
        expect(comparison).not_to have_key('expected_level')
      end

      it 'stores the correct required_level value from the vacancy skill' do
        report = run_engine
        expect(report.skill_comparisons.first['required_level']).to eq(3)
      end

      it 'includes is_override key set to false when no override exists' do
        report = run_engine
        expect(report.skill_comparisons.first['is_override']).to eq(false)
      end

      it 'includes confidence from the portfolio skill' do
        report = run_engine
        expect(report.skill_comparisons.first['confidence']).to eq('high')
      end

      it 'includes all required keys' do
        report = run_engine
        comp   = report.skill_comparisons.first
        %w[skill_label skill_id candidate_level required_level result delta confidence is_override].each do |key|
          expect(comp).to have_key(key), "expected key '#{key}' to be present"
        end
      end
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # 2. Result computation
  # ══════════════════════════════════════════════════════════════════════════
  describe 'result classification' do
    it 'returns match when candidate_level equals required_level' do
      create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-001', skill_label: 'Ruby on Rails', ai_level: 3)
      report = run_engine
      expect(report.skill_comparisons.first['result']).to eq('match')
    end

    it 'returns exceed when candidate_level is above required_level' do
      create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-001', skill_label: 'Ruby on Rails', ai_level: 5)
      report = run_engine
      comp   = report.skill_comparisons.first
      expect(comp['result']).to eq('exceed')
      expect(comp['delta']).to  eq(2)
    end

    it 'returns gap when candidate_level is below required_level' do
      create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-001', skill_label: 'Ruby on Rails', ai_level: 1)
      report = run_engine
      comp   = report.skill_comparisons.first
      expect(comp['result']).to eq('gap')
      expect(comp['delta']).to  eq(-2)
    end

    it 'returns not_assessed when no portfolio skill matches the vacancy skill' do
      # portfolio is empty — no portfolio_skills created
      report = run_engine
      comp   = report.skill_comparisons.first
      expect(comp['result']).to          eq('not_assessed')
      expect(comp['candidate_level']).to be_nil
      expect(comp['delta']).to           be_nil
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # 3. is_override propagation (the critical bug fix)
  # ══════════════════════════════════════════════════════════════════════════
  describe 'is_override propagation' do
    let!(:portfolio_skill) do
      create(:portfolio_skill,
             portfolio:    portfolio,
             skill_id:     'SK-ENG-001',
             skill_label:  'Ruby on Rails',
             ai_level:     2,
             ai_confidence: 'medium')
    end

    context 'when an assessor override exists' do
      before do
        create(:assessor_override,
               portfolio_skill: portfolio_skill,
               ai_level:        2,
               override_level:  4)
      end

      it 'sets is_override to true in skill_comparisons' do
        report = run_engine
        expect(report.skill_comparisons.first['is_override']).to eq(true)
      end

      it 'uses override_level as the effective candidate_level, not ai_level' do
        report = run_engine
        expect(report.skill_comparisons.first['candidate_level']).to eq(4)
      end

      it 'computes result based on the override level (exceed: 4 vs required 3)' do
        report = run_engine
        comp   = report.skill_comparisons.first
        expect(comp['result']).to eq('exceed')
        expect(comp['delta']).to  eq(1)
      end
    end

    context 'when no assessor override exists' do
      it 'sets is_override to false' do
        report = run_engine
        expect(report.skill_comparisons.first['is_override']).to eq(false)
      end

      it 'uses ai_level as candidate_level' do
        report = run_engine
        expect(report.skill_comparisons.first['candidate_level']).to eq(2)
      end
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # 4. Skill matching logic
  # ══════════════════════════════════════════════════════════════════════════
  describe 'skill matching' do
    it 'matches by skill_id first when both skill_id and skill_label differ' do
      # skill_label doesn't match but skill_id does — should still match
      create(:portfolio_skill,
             portfolio:   portfolio,
             skill_id:    'SK-ENG-001',
             skill_label: 'Rails (Different Label)',
             ai_level:    3)
      report = run_engine
      expect(report.skill_comparisons.first['result']).to eq('match')
    end

    it 'falls back to case-insensitive label match when skill_id is absent' do
      create(:portfolio_skill,
             portfolio:   portfolio,
             skill_id:    nil,
             skill_label: 'ruby on rails',  # lowercase — should still match
             ai_level:    3)
      report = run_engine
      expect(report.skill_comparisons.first['result']).to eq('match')
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # 5. Narratives
  # ══════════════════════════════════════════════════════════════════════════
  describe 'narrative generation' do
    before { create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-001', skill_label: 'Ruby on Rails', ai_level: 3) }

    it 'stores culture_narrative from Gemini response' do
      report = run_engine
      expect(report.culture_narrative).to eq('Good culture fit.')
    end

    it 'stores overall_narrative from Gemini response' do
      report = run_engine
      expect(report.overall_narrative).to eq('Recommend proceeding.')
    end

    context 'when Gemini raises an error' do
      before do
        allow(gemini_client).to receive(:generate_content).and_raise(StandardError, 'timeout')
      end

      it 'falls back gracefully and still persists a report' do
        report = run_engine
        expect(report).to be_persisted
        expect(report.culture_narrative).to be_nil
        expect(report.overall_narrative).to be_present   # fallback text
      end
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # 6. Idempotency — calling engine twice should upsert, not duplicate
  # ══════════════════════════════════════════════════════════════════════════
  describe 'idempotency' do
    before { create(:portfolio_skill, portfolio: portfolio, skill_id: 'SK-ENG-001', skill_label: 'Ruby on Rails', ai_level: 3) }

    it 'does not create duplicate FitGapReport records on repeated calls' do
      run_engine
      expect { run_engine }.not_to change(FitGapReport, :count)
    end

    it 'updates generated_at on the second call' do
      first_report  = run_engine
      first_time    = first_report.generated_at
      travel(1.second) { run_engine }
      expect(first_report.reload.generated_at).to be > first_time
    end
  end

  # ══════════════════════════════════════════════════════════════════════════
  # SEEDED FAULT TEST
  # Proves the test catches the original bug where is_override was never set.
  # To reproduce the failure: comment out `is_override:` in engine.rb and
  # run this spec — it will turn red.
  # ══════════════════════════════════════════════════════════════════════════
  describe 'SEEDED FAULT — is_override omission regression' do
    let!(:ps) do
      create(:portfolio_skill,
             portfolio:    portfolio,
             skill_id:     'SK-ENG-001',
             skill_label:  'Ruby on Rails',
             ai_level:     2,
             ai_confidence: 'low')
    end

    before { create(:assessor_override, portfolio_skill: ps, ai_level: 2, override_level: 4) }

    it 'fails (red) if is_override is omitted from skill_comparisons — regression guard' do
      report = run_engine
      comp   = report.skill_comparisons.first
      # If the bug is reintroduced, comp['is_override'] will be nil/false — test goes red
      expect(comp['is_override']).to eq(true),
        "Expected is_override=true when assessor override present, got #{comp['is_override'].inspect}. " \
        "This guards against regression of the is_override omission bug."
    end
  end
end
