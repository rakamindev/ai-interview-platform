# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGap::Engine do
  let(:org)       { build_org }
  let(:session)   { build_session(org) }
  let(:portfolio) { build_portfolio(session) }
  let(:vacancy)   { build_vacancy(org, skills: { 'React' => 3, 'SQL' => 3 }, culture: 'Ownership') }
  let(:gemini)    { double('gemini') } # rubocop:disable RSpec/VerifiedDoubles
  let(:good)      { { 'culture_narrative' => 'Culture ok.', 'overall_narrative' => 'Overall ok.' } }

  subject(:engine) { described_class.new(portfolio: portfolio, vacancy: vacancy, gemini_client: gemini) }

  before do
    add_portfolio_skill(portfolio, label: 'React', level: 2)
  end

  def report
    FitGapReport.find_by!(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
  end

  describe '#refresh_comparisons!' do
    it 'writes the comparison and summary without calling the model' do
      expect(gemini).not_to receive(:generate_content)
      engine.refresh_comparisons!

      expect(report.skill_comparisons.map { |c| [c['skill_label'], c['result']] })
        .to contain_exactly(%w[React gap], %w[SQL not_assessed])
      expect(report.summary).to include('total' => 2, 'assessed' => 1, 'coverage_pct' => 50)
      expect(report.narrative_status).to eq('pending')
    end

    it 'is idempotent: calling twice leaves exactly one row' do
      2.times { engine.refresh_comparisons! }
      expect(FitGapReport.where(portfolio_id: portfolio.id, vacancy_id: vacancy.id).count).to eq(1)
    end

    it 'survives two jobs racing to create the same row (unique index)' do
      allow(FitGapReport).to receive(:find_or_initialize_by).and_wrap_original do |original, *args|
        built = original.call(*args)
        FitGapReport.create!(portfolio_id: portfolio.id, vacancy_id: vacancy.id, skill_comparisons: [])
        built
      end

      expect { engine.refresh_comparisons! }.not_to raise_error
      expect(FitGapReport.where(portfolio_id: portfolio.id, vacancy_id: vacancy.id).count).to eq(1)
      expect(report.skill_comparisons).not_to be_empty
    end

    it 'handles a vacancy with no required skills' do
      empty = build_vacancy(org, skills: {})
      described_class.new(portfolio: portfolio, vacancy: empty, gemini_client: gemini).refresh_comparisons!
      saved = FitGapReport.find_by!(portfolio_id: portfolio.id, vacancy_id: empty.id)
      expect(saved.skill_comparisons).to eq([])
      expect(saved.summary).to include('total' => 0, 'coverage_pct' => nil)
    end

    it 'marks a ready narrative pending again when an assessor override changes the facts' do
      allow(gemini).to receive(:generate_content).and_return(good)
      engine.generate_narrative!
      expect(report.narrative_status).to eq('ready')

      AssessorOverride.create!(portfolio_skill: portfolio.portfolio_skills.first, ai_level: 2,
                               override_level: 3, overridden_by: 42)
      engine.refresh_comparisons!

      expect(report.narrative_status).to eq('pending')
      expect(report.skill_comparisons.find { |c| c['skill_label'] == 'React' })
        .to include('result' => 'match', 'is_override' => true)
    end

    it 'leaves a ready narrative alone when nothing changed' do
      allow(gemini).to receive(:generate_content).and_return(good)
      engine.generate_narrative!
      engine.refresh_comparisons!
      expect(report.narrative_status).to eq('ready')
    end
  end

  describe '#generate_narrative!' do
    it 'stores both narratives and marks the report ready' do
      allow(gemini).to receive(:generate_content).and_return(good)
      engine.generate_narrative!
      expect(report).to have_attributes(culture_narrative: 'Culture ok.', overall_narrative: 'Overall ok.',
                                        narrative_status: 'ready', generation_error: nil)
    end

    it 'is a no-op for a duplicate job on unchanged inputs' do
      expect(gemini).to receive(:generate_content).once.and_return(good)
      2.times { engine.generate_narrative! }
    end

    it 'skips the model entirely when nothing was assessed' do
      PortfolioSkill.where(portfolio_id: portfolio.id).destroy_all
      expect(gemini).not_to receive(:generate_content)
      engine.generate_narrative!
      expect(report).to have_attributes(narrative_status: 'ready', culture_narrative: nil, overall_narrative: nil)
    end

    it 'never makes a hiring recommendation, never sends candidate quotes, and follows the assessment language' do
      session.assessment.update!(language: 'id')
      portfolio.portfolio_skills.first.update!(evidence: ['my private anecdote'])
      prompt = nil
      allow(gemini).to receive(:generate_content) { |p, **| prompt = p and good }

      engine.generate_narrative!

      expect(prompt).to include('Do NOT recommend hiring or rejecting')
      expect(prompt).to include('Bahasa Indonesia')
      expect(prompt).to include('React (candidate L2 vs required L3')
      expect(prompt).not_to include('my private anecdote')
    end

    it 'truncates over-long model output' do
      allow(gemini).to receive(:generate_content)
        .and_return('culture_narrative' => 'x' * 5000, 'overall_narrative' => 'ok')
      engine.generate_narrative!
      expect(report.culture_narrative.length).to be <= FitGap::Engine::MAX_NARRATIVE_CHARS
    end

    context 'when the model fails' do
      it 'keeps the comparison, stores a factual fallback and marks the narrative failed' do
        allow(gemini).to receive(:generate_content).and_raise(Gemini::HttpClient::TimeoutError.new('boom'))

        expect { engine.generate_narrative! }.not_to raise_error

        expect(report).to have_attributes(narrative_status: 'failed', culture_narrative: nil,
                                          generation_error: 'Gemini::HttpClient::TimeoutError',
                                          narrative_digest: nil)
        expect(report.overall_narrative).to include('2 required skills', '1 fall short', '1 were not assessed')
        expect(report.skill_comparisons.size).to eq(2)
      end

      it 'does not write the model error message (it may echo candidate data) to the log' do
        allow(gemini).to receive(:generate_content).and_raise(StandardError, 'leaked candidate answer')
        allow(Rails.logger).to receive(:error)

        engine.generate_narrative!

        expect(Rails.logger).to have_received(:error).with(satisfy { |m| !m.include?('leaked candidate answer') })
      end

      it 'treats malformed model output as a failure' do
        allow(gemini).to receive(:generate_content).and_return('this is not json')
        engine.generate_narrative!
        expect(report.narrative_status).to eq('failed')
      end

      it 'treats an empty or wrongly-typed answer as a failure' do
        allow(gemini).to receive(:generate_content).and_return('culture_narrative' => 12, 'overall_narrative' => ' ')
        engine.generate_narrative!
        expect(report.narrative_status).to eq('failed')
      end

      it 'retries for real after a failure (a failed narrative is never treated as ready)' do
        allow(gemini).to receive(:generate_content).and_raise(StandardError, 'x')
        engine.generate_narrative!
        allow(gemini).to receive(:generate_content).and_return(good)
        engine.generate_narrative!
        expect(report).to have_attributes(narrative_status: 'ready', culture_narrative: 'Culture ok.')
      end
    end

    it 'discards a result computed from stale inputs when an override lands mid-call' do
      allow(gemini).to receive(:generate_content) do
        AssessorOverride.create!(portfolio_skill: portfolio.portfolio_skills.first, ai_level: 2,
                                 override_level: 3, overridden_by: 42)
        good
      end

      engine.generate_narrative!

      expect(report).to have_attributes(culture_narrative: nil, narrative_status: 'pending')
    end
  end
end
