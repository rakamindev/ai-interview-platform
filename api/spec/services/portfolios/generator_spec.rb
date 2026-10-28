# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:assessment) do
    Assessment.create!(tenant_id: 1, created_by: 1, name: 'Backend Engineer', time_limit_min: 30)
  end
  let(:interview_session) { Session.create!(tenant_id: 1, assessment: assessment) }
  let(:client) { double('gemini_client') }

  def skill(label, level: 3, confidence: 'high', id: nil)
    {
      'skill_id'           => id,
      'skill_label'        => label,
      'level'              => level,
      'confidence'         => confidence,
      'evidence'           => ['I split the work into small steps.'],
      'competency_summary' => 'Works independently on routine scope.'
    }
  end

  def run_generator
    described_class.new(session: interview_session, gemini_client: client).call
  end

  def generate(payload)
    allow(client).to receive(:generate_content).and_return(payload)
    run_generator
  end

  def saved_labels(portfolio)
    portfolio.portfolio_skills.order(:skill_label).pluck(:skill_label)
  end

  describe 'saving skills' do
    it 'stores valid configured and discovered skills and completes the portfolio' do
      portfolio = generate(
        'configured_skills' => [skill('React', id: 'sk-1')],
        'discovered_skills' => [skill('Testing', level: 2)]
      )

      expect(portfolio).to be_complete
      expect(saved_labels(portfolio)).to eq(%w[React Testing])
    end

    it 'does not store a skill without a level as L1' do
      portfolio = generate('configured_skills' => [skill('React'), skill('SQL', level: nil)])

      expect(saved_labels(portfolio)).to eq(['React'])
    end

    it 'rejects an out-of-range level instead of clamping it' do
      portfolio = generate('configured_skills' => [skill('React'), skill('Go', level: 9)])

      expect(saved_labels(portfolio)).to eq(['React'])
    end

    it 'rejects a fractional level instead of truncating it' do
      portfolio = generate('configured_skills' => [skill('React'), skill('Go', level: 2.5)])

      expect(saved_labels(portfolio)).to eq(['React'])
    end

    it 'accepts a whole-number level sent as a string' do
      portfolio = generate('configured_skills' => [skill('React', level: '4')])

      expect(portfolio.portfolio_skills.first.ai_level).to eq(4)
    end

    it 'falls back to low confidence for an unknown confidence value' do
      portfolio = generate('configured_skills' => [skill('React', confidence: 'very sure')])

      expect(portfolio.portfolio_skills.first.ai_confidence).to eq('low')
    end

    it 'keeps one row when the model repeats a skill' do
      portfolio = generate(
        'configured_skills' => [skill('React', id: 'sk-1'), skill('react', id: 'sk-1', level: 4)]
      )

      expect(portfolio.portfolio_skills.count).to eq(1)
      expect(portfolio.portfolio_skills.first.ai_level).to eq(3)
    end
  end

  describe 'failure paths' do
    it 'fails the portfolio when the model returns no usable skill' do
      expect { generate('configured_skills' => [skill('React', level: nil)]) }
        .to raise_error(described_class::InvalidOutput)

      portfolio = interview_session.reload.portfolio
      expect(portfolio).to be_failed
      expect(portfolio.portfolio_skills).to be_empty
    end

    it 'does not leak model output into the stored error' do
      quote = 'I rewrote the billing engine alone'

      expect { generate("not json, #{quote}") }.to raise_error(described_class::InvalidOutput)

      expect(interview_session.reload.portfolio.generation_error).not_to include(quote)
    end

    it 'rolls back every skill when a later row is rejected by the database' do
      # The label passes our checks but is longer than the varchar(255) column,
      # so the database rejects it after the first skill was already inserted.
      payload = { 'configured_skills' => [skill('React'), skill('x' * 300)] }

      expect { generate(payload) }.to raise_error(ActiveRecord::StatementInvalid)

      portfolio = interview_session.reload.portfolio
      expect(portfolio).to be_failed
      expect(portfolio.portfolio_skills).to be_empty
    end
  end

  describe 'duplicate or retried jobs' do
    it 'leaves a finished portfolio and its assessor overrides untouched' do
      portfolio = generate('configured_skills' => [skill('React', id: 'sk-1')])
      react = portfolio.portfolio_skills.first
      AssessorOverride.create!(portfolio_skill: react, ai_level: 3, override_level: 4, overridden_by: 1)

      expect(client).not_to receive(:generate_content)
      run_generator

      expect(react.reload.assessor_override.override_level).to eq(4)
      expect(saved_labels(portfolio)).to eq(['React'])
    end

    it 'does not replace skills when another job finishes while the model call is running' do
      allow(client).to receive(:generate_content) do
        other = Portfolio.find_by!(session_id: interview_session.id)
        other.portfolio_skills.create!(
          skill_label: 'React', ai_level: 3, ai_confidence: 'high',
          competency_summary: 'Saved by the parallel job.'
        )
        other.update!(generation_status: 'complete')
        { 'configured_skills' => [skill('Python', level: 2)] }
      end

      run_generator

      saved = Portfolio.find_by!(session_id: interview_session.id)
      expect(saved).to be_complete
      expect(saved_labels(saved)).to eq(['React'])
    end
  end
end
