# frozen_string_literal: true

require 'rails_helper'
require 'sidekiq/testing'

RSpec.describe 'Fit-gap lifecycle' do
  before do
    Sidekiq::Testing.fake!
    FitGapGeneratorWorker.clear
  end

  def create_context(with_override: true)
    org = Organization.create!(
      name: "Fit Gap Corp #{SecureRandom.hex(3)}",
      scheme: "fit-gap-#{SecureRandom.hex(3)}",
      identifier: "fit-gap-#{SecureRandom.hex(3)}",
      host: "fit-gap-#{SecureRandom.hex(3)}.test"
    )

    Current.using(tenant_id: org.id) do
      assessment = Assessment.create!(name: 'Fit Gap Assessment', created_by: 1, time_limit_min: 30)
      session = Session.create!(assessment:, candidate_name: 'Candidate', status: 'ended')
      portfolio = Portfolio.create!(session:, generation_status: 'complete')
      react = portfolio.portfolio_skills.create!(
        skill_id: 'react',
        skill_label: 'React',
        ai_level: 2,
        ai_confidence: 'high',
        evidence: [],
        competency_summary: 'React summary'
      )
      database = portfolio.portfolio_skills.create!(
        skill_id: 'database',
        skill_label: 'Database',
        ai_level: 3,
        ai_confidence: 'medium',
        evidence: [],
        competency_summary: 'Database summary'
      )
      portfolio.portfolio_skills.create!(
        skill_id: 'architecture',
        skill_label: 'Architecture',
        ai_level: 4,
        ai_confidence: 'high',
        evidence: [],
        competency_summary: 'Architecture summary'
      )
      override = if with_override
                   react.create_assessor_override!(
                     ai_level: 2,
                     override_level: 3,
                     overridden_by: 1,
                     overridden_at: Time.zone.parse('2026-10-24 10:00:00')
                   )
                 end
      vacancy = Vacancy.create!(
        role_title: 'Frontend Engineer',
        culture_dimensions: 'Ownership',
        competency_expectations: 'Frontend delivery',
        created_by: 1,
        vacancy_skills_attributes: [
          { skill_id: 'react', skill_label: 'React', expected_level: 4 },
          { skill_id: 'database', skill_label: 'Database', expected_level: 3 },
          { skill_id: 'architecture', skill_label: 'Architecture', expected_level: 2 },
          { skill_id: 'system', skill_label: 'System Design', expected_level: 5 }
        ]
      )

      { org:, portfolio:, vacancy:, react:, database:, override: }
    end
  end

  def generated_attributes
    {
      skill_comparisons: [{
        skill_id: 'react', skill_label: 'React', expected_level: 4,
        candidate_level: 3, ai_level: 2, rating_source: 'assessor_override',
        result: 'gap', delta: -1, confidence: 'high'
      }],
      culture_narrative: 'Culture narrative',
      overall_narrative: 'Overall narrative'
    }
  end

  describe FitGap::SourceFingerprint do
    it 'is stable when skill records are returned in a different order' do
      context = create_context
      original = described_class.call(portfolio: context[:portfolio], vacancy: context[:vacancy]).fingerprint
      portfolio_skills = context[:portfolio].portfolio_skills.includes(:assessor_override).to_a.reverse
      vacancy_skills = context[:vacancy].vacancy_skills.to_a.reverse

      allow(context[:portfolio]).to receive(:portfolio_skills)
        .and_return(double(includes: portfolio_skills))
      allow(context[:vacancy]).to receive(:vacancy_skills).and_return(vacancy_skills)

      reordered = described_class.call(portfolio: context[:portfolio], vacancy: context[:vacancy]).fingerprint
      expect(reordered).to eq(original)
    end

    it 'changes for decision-relevant vacancy and override inputs' do
      context = create_context
      original = described_class.call(portfolio: context[:portfolio], vacancy: context[:vacancy]).fingerprint

      context[:vacancy].update_column(:culture_dimensions, 'Collaboration')
      vacancy_changed = described_class.call(portfolio: context[:portfolio], vacancy: context[:vacancy].reload).fingerprint
      expect(vacancy_changed).not_to eq(original)

      context[:override].update_columns(override_level: 4, overridden_at: 1.minute.from_now)
      override_changed = described_class.call(portfolio: context[:portfolio].reload, vacancy: context[:vacancy]).fingerprint
      expect(override_changed).not_to eq(vacancy_changed)
    end
  end

  describe FitGap::Engine do
    it 'emits expected level, AI level, and descriptive rating provenance' do
      context = create_context
      snapshot = FitGap::SourceFingerprint.call(portfolio: context[:portfolio], vacancy: context[:vacancy])
      client = instance_double(Gemini::HttpClient)
      allow(client).to receive(:generate_content).and_return(
        'culture_narrative' => 'Culture',
        'overall_narrative' => 'Overall'
      )

      comparisons = described_class.new(snapshot:, gemini_client: client).generate[:skill_comparisons]

      expect(comparisons).to include(
        include(
          skill_id: 'react', expected_level: 4, candidate_level: 3, ai_level: 2,
          rating_source: 'assessor_override', result: 'gap', delta: -1
        ),
        include(
          skill_id: 'database', expected_level: 3, candidate_level: 3, ai_level: 3,
          rating_source: 'ai', result: 'match', delta: 0
        ),
        include(
          skill_id: 'architecture', expected_level: 2, candidate_level: 4, ai_level: 4,
          rating_source: 'ai', result: 'exceed', delta: 2
        ),
        include(
          skill_id: 'system', expected_level: 5, candidate_level: nil, ai_level: nil,
          rating_source: nil, result: 'not_assessed', delta: nil
        )
      )
    end

    it 'returns an empty comparison array for a vacancy without skill requirements' do
      context = create_context
      empty_vacancy = Current.using(tenant_id: context[:org].id) do
        Vacancy.create!(role_title: 'Generalist', created_by: 1)
      end
      snapshot = FitGap::SourceFingerprint.call(portfolio: context[:portfolio], vacancy: empty_vacancy)
      client = instance_double(Gemini::HttpClient, generate_content: {})

      result = described_class.new(snapshot:, gemini_client: client).generate

      expect(result[:skill_comparisons]).to eq([])
    end
  end

  describe FitGap::RegenerationCoordinator do
    it 'deduplicates repeated requests while preserving the report row' do
      context = create_context
      allow(FitGapGeneratorWorker).to receive(:perform_async)

      first = described_class.request!(portfolio: context[:portfolio], vacancy: context[:vacancy])
      second = described_class.request!(portfolio: context[:portfolio], vacancy: context[:vacancy])

      expect(first.id).to eq(second.id)
      expect(second).to be_generating
      expect(FitGapGeneratorWorker).to have_received(:perform_async).once
    end

    it 'rejects portfolios and vacancies from different tenants' do
      first = create_context
      second = create_context

      expect do
        described_class.request!(portfolio: first[:portfolio], vacancy: second[:vacancy])
      end.to raise_error(ArgumentError, 'Portfolio and vacancy must belong to the same tenant')
    end

    it 'invalidates the same report after vacancy and override semantic changes' do
      context = create_context
      allow(FitGapGeneratorWorker).to receive(:perform_async)
      report = described_class.request!(portfolio: context[:portfolio], vacancy: context[:vacancy])
      original_fingerprint = report.requested_fingerprint
      report.update!(
        **generated_attributes,
        source_fingerprint: original_fingerprint,
        generation_status: 'complete',
        generated_at: Time.current
      )

      vacancy_skill = context[:vacancy].vacancy_skills.find_by!(skill_id: 'react')
      vacancy_skill.update!(expected_level: 5)

      expect(report.reload).to be_generating
      expect(report.requested_fingerprint).not_to eq(original_fingerprint)
      vacancy_fingerprint = report.requested_fingerprint

      report.update!(
        source_fingerprint: vacancy_fingerprint,
        generation_status: 'complete'
      )
      context[:override].update!(override_level: 4, overridden_at: 1.minute.from_now)

      expect(report.reload).to be_generating
      expect(report.requested_fingerprint).not_to eq(vacancy_fingerprint)
      expect(FitGapGeneratorWorker).to have_received(:perform_async).exactly(3).times
    end

    it 'keeps one active job while rapid portfolio and vacancy changes update the requested fingerprint' do
      context = create_context
      allow(FitGapGeneratorWorker).to receive(:perform_async)
      report = described_class.request!(portfolio: context[:portfolio], vacancy: context[:vacancy])
      initial_fingerprint = report.requested_fingerprint
      report.update!(
        **generated_attributes,
        source_fingerprint: initial_fingerprint,
        generation_status: 'complete',
        generated_at: Time.current
      )

      context[:database].update!(ai_level: 4)
      after_portfolio_change = report.reload.requested_fingerprint
      context[:vacancy].vacancy_skills.find_by!(skill_id: 'database').update!(expected_level: 4)

      expect(report.reload).to be_generating
      expect(report.requested_fingerprint).not_to eq(after_portfolio_change)
      expect(FitGapGeneratorWorker).to have_received(:perform_async).twice
    end
  end

  describe FitGapGeneratorWorker do
    it 'publishes a report only when the captured fingerprint is still current' do
      context = create_context
      allow(described_class).to receive(:perform_async)
      report = FitGap::RegenerationCoordinator.request!(portfolio: context[:portfolio], vacancy: context[:vacancy])
      allow(FitGap::Engine).to receive(:new).and_return(double(generate: generated_attributes))

      described_class.new.perform(context[:portfolio].id, context[:vacancy].id, report.requested_fingerprint)

      expect(report.reload).to be_complete
      expect(report.freshness).to eq('current')
      expect(report.skill_comparisons.first['rating_source']).to eq('assessor_override')
    end

    it 'keeps the generated snapshot stale and queues one reconciliation when inputs change mid-flight' do
      context = create_context
      allow(described_class).to receive(:perform_async)
      report = FitGap::RegenerationCoordinator.request!(portfolio: context[:portfolio], vacancy: context[:vacancy])
      captured = report.requested_fingerprint
      engine = double
      allow(engine).to receive(:generate) do
        context[:vacancy].vacancy_skills.find_by!(skill_id: 'react').update_column(:expected_level, 5)
        generated_attributes
      end
      allow(FitGap::Engine).to receive(:new).and_return(engine)

      described_class.new.perform(context[:portfolio].id, context[:vacancy].id, captured)

      report.reload
      expect(report).to be_generating
      expect(report.source_fingerprint).to eq(captured)
      expect(report.requested_fingerprint).not_to eq(captured)
      expect(described_class).to have_received(:perform_async)
        .with(context[:portfolio].id, context[:vacancy].id, report.requested_fingerprint)
    end

    it 'marks only the exhausted requested generation failed and preserves its last payload' do
      context = create_context
      fingerprint = FitGap::SourceFingerprint.call(portfolio: context[:portfolio], vacancy: context[:vacancy]).fingerprint
      report = Current.using(tenant_id: context[:org].id) do
        FitGapReport.create!(
          portfolio: context[:portfolio],
          vacancy: context[:vacancy],
          skill_comparisons: generated_attributes[:skill_comparisons],
          overall_narrative: 'Last known result',
          generated_at: 1.hour.ago,
          source_fingerprint: 'older',
          requested_fingerprint: fingerprint,
          generation_status: 'generating'
        )
      end

      described_class.mark_failed(context[:portfolio].id, context[:vacancy].id, fingerprint)

      expect(report.reload).to be_failed
      expect(report.overall_narrative).to eq('Last known result')
      expect(report.freshness).to eq('failed')
    end

    it 'does not cross tenant boundaries when resolving a vacancy' do
      first = create_context
      second = create_context

      expect(FitGap::Engine).not_to receive(:new)
      expect do
        described_class.new.perform(first[:portfolio].id, second[:vacancy].id, 'fingerprint')
      end.not_to raise_error
    end
  end
end
