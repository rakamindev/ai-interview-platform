# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  # F-08: AI output validation — confidence normalization + best-effort partial
  # save so a single odd LLM field cannot sink the whole portfolio generation.
  let(:org) do
    Organization.create!(
      name: 'Portfolio Gen Corp',
      scheme: 'portfolio-gen-test',
      identifier: 'portfolio-gen-test',
      host: 'portfolio-gen.test.local'
    )
  end

  let(:assessment) do
    record = Assessment.create!(
      name: 'React Developer',
      tenant_id: org.id,
      created_by: 1,
      time_limit_min: 30
    )
    record.assessment_skills.create!(
      skill_id: 'react',
      skill_label: 'React',
      l1_anchor: 'L1',
      l2_anchor: 'L2',
      l3_anchor: 'L3',
      l4_anchor: 'L4',
      l5_anchor: 'L5',
      expected_level: 3,
      display_order: 0
    )
    record
  end

  let(:session) do
    record = Session.create!(
      assessment_id: assessment.id,
      tenant_id: org.id,
      candidate_id: 'cand-pgen',
      candidate_name: 'Candidate PG',
      status: 'ended'
    )
    record.coverage_maps.create!(
      skill_id: 'react',
      skill_label: 'React',
      state: 'covered',
      probe_count: 3,
      is_discovered: false
    )
    record
  end

  let(:gemini_client) { double('Gemini::HttpClient') }

  let!(:candidate_turn) do
    session.transcript_turns.create!(
      turn_number: 2,
      speaker: 'candidate',
      text: 'I measured render latency before choosing the component boundary.'
    )
  end

  let(:generator) do
    described_class.new(session: session, gemini_client: gemini_client)
  end

  def run_generator!(payload)
    allow(gemini_client).to receive(:generate_content).and_return(payload)
    Current.using(tenant_id: org.id) { generator.call }
  end

  def in_tenant(&block)
    Current.using(tenant_id: org.id, &block)
  end

  def skill(label, confidence: 'high', summary: 'Competency summary')
    {
      'skill_id'           => label.downcase.gsub(/\s+/, '-'),
      'skill_label'        => label,
      'level'              => 3,
      'confidence'         => confidence,
      'evidence'           => [{
        'turn_number' => candidate_turn.turn_number,
        'quote' => 'I measured render latency before choosing the component boundary.'
      }],
      'competency_summary' => summary
    }
  end

  describe '#call' do
    context 'normal flow (all skills valid)' do
      it 'saves configured and discovered skills and marks portfolio complete' do
        portfolio = run_generator!(
          'configured_skills' => [skill('React'), skill('Rails')],
          'discovered_skills' => [skill('GraphQL')]
        )

        in_tenant do
          expect(portfolio.generation_status).to eq('complete')
          expect(portfolio.portfolio_skills.count).to eq(3)
          expect(portfolio.portfolio_skills.pluck(:ai_level)).to all(be_between(1, 5))
        end
      end

      it 'asks for explicit turn references in the model contract' do
        allow(gemini_client).to receive(:generate_content) do |prompt, **|
          expect(prompt).to include('[TURN 2][CANDIDATE]')
          expect(prompt).to include('"turn_number": 14')
          { 'configured_skills' => [skill('React')], 'discovered_skills' => [] }
        end

        in_tenant { generator.call }
      end

      it 'persists only same-session candidate citations and keeps the skill when others are invalid' do
        session.transcript_turns.create!(turn_number: 1, speaker: 'ai', text: 'Tell me about React.')
        payload = skill('React').merge(
          'evidence' => [
            { 'turn_number' => 2, 'quote' => 'I measured render latency before choosing the component boundary.' },
            { 'turn_number' => 1, 'quote' => 'Tell me about React.' },
            { 'turn_number' => 2, 'quote' => 'I always choose components without measuring anything.' }
          ]
        )

        portfolio = run_generator!('configured_skills' => [payload], 'discovered_skills' => [])
        saved_skill = in_tenant { portfolio.portfolio_skills.first }

        expect(portfolio.generation_status).to eq('complete')
        expect(saved_skill.evidence_status).to eq('verified')
        expect(saved_skill.evidence).to contain_exactly(
          hash_including('turn_id' => candidate_turn.id, 'verification_status' => 'verified')
        )
      end

      it 'retains a skill with an explicit insufficient evidence status when every citation is rejected' do
        payload = skill('React').merge(
          'evidence' => [{ 'turn_number' => 2, 'quote' => 'A fabricated paraphrase.' }]
        )

        portfolio = run_generator!('configured_skills' => [payload], 'discovered_skills' => [])
        saved_skill = in_tenant { portfolio.portfolio_skills.first }

        expect(portfolio.generation_status).to eq('complete')
        expect(saved_skill.evidence).to eq([])
        expect(saved_skill.evidence_status).to eq('insufficient')
      end

      it 'clears an earlier generation error after a successful retry' do
        in_tenant do
          session.create_portfolio!(generation_status: 'failed', generation_error: 'API returned 503')
        end

        portfolio = run_generator!(
          'configured_skills' => [skill('React')],
          'discovered_skills' => []
        )

        expect(portfolio.generation_status).to eq('complete')
        expect(portfolio.generation_error).to be_nil
      end
    end

    context 'invalid source data' do
      it 'fails without calling Gemini when the assessment has no skills' do
        assessment.assessment_skills.destroy_all
        expect(gemini_client).not_to receive(:generate_content)

        portfolio = in_tenant { generator.call }

        expect(portfolio.generation_status).to eq('failed')
        expect(portfolio.generation_error).to eq('Assessment has no skills to evaluate')
      end

      it 'fails without calling Gemini when the session has no coverage map' do
        session.coverage_maps.destroy_all
        expect(gemini_client).not_to receive(:generate_content)

        portfolio = in_tenant { generator.call }

        expect(portfolio.generation_status).to eq('failed')
        expect(portfolio.generation_error).to eq('Session has no skill coverage to evaluate')
      end
    end

    context 'empty AI output' do
      it 'raises a retriable error instead of reporting an empty validation message' do
        expect do
          run_generator!(
            'configured_skills' => [],
            'discovered_skills' => []
          )
        end.to raise_error(Portfolios::Generator::EmptyAiOutputError, 'AI returned no skill assessments')

        expect(session.portfolio.reload.generation_status).to eq('failed')
        expect(session.portfolio.generation_error).to eq('AI returned no skill assessments')
      end
    end

    context 'confidence normalization (F-08)' do
      it 'maps casing, verbose, blank, and unknown values onto the enum' do
        portfolio = run_generator!(
          'configured_skills' => [
            skill('Skill A', confidence: 'HIGH'),
            skill('Skill B', confidence: 'high confidence'),
            skill('Skill C', confidence: nil),
            skill('Skill D', confidence: 'low'),
            skill('Skill E', confidence: 'banana')
          ],
          'discovered_skills' => []
        )

        in_tenant do
          expect(portfolio.generation_status).to eq('complete')
          confidences = portfolio.portfolio_skills.order(:id).pluck(:ai_confidence)
          expect(confidences).to eq(%w[high high medium low medium])
        end
      end

      it 'keeps the model enum enforcement intact for invalid values' do
        expect do
          in_tenant do
            portfolio = run_generator!(
              'configured_skills' => [skill('Skill X')],
              'discovered_skills' => []
            )
            portfolio.portfolio_skills.create!(ai_confidence: 'OUTLIER')
          end
        end.to raise_error(ActiveRecord::RecordInvalid)
      end
    end

    context 'one invalid skill (F-08 partial save)' do
      it 'saves the valid skills, marks portfolio partial, and records the error' do
        portfolio = run_generator!(
          'configured_skills' => [
            skill('React'),
            skill('Rails'),
            skill('Broken', confidence: 'high', summary: nil)
          ],
          'discovered_skills' => []
        )

        in_tenant do
          expect(portfolio.generation_status).to eq('partial')
          expect(portfolio.portfolio_skills.count).to eq(2)
          expect(portfolio.portfolio_skills.pluck(:skill_label)).to contain_exactly('React', 'Rails')
          expect(portfolio.generation_error).to include('Broken')
          expect(portfolio.generation_error).to include('1')
        end
      end
    end

    context 'all skills invalid (F-08)' do
      it 'marks portfolio failed — not a fake partial' do
        portfolio = run_generator!(
          'configured_skills' => [
            skill('Broken A', summary: nil),
            skill('Broken B', summary: nil)
          ],
          'discovered_skills' => []
        )

        in_tenant do
          expect(portfolio.generation_status).to eq('failed')
          expect(portfolio.portfolio_skills.count).to eq(0)
          expect(portfolio.generation_error).to include('All skills failed to save')
        end
      end
    end

    context 'unparseable AI payload' do
      it 'falls back to failed via the outer rescue' do
        expect do
          run_generator!('not valid json')
        end.to raise_error(JSON::ParserError)

        in_tenant do
          expect(session.portfolio.reload.generation_status).to eq('failed')
        end
      end
    end
  end
end
