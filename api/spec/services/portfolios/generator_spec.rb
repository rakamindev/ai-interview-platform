# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:session) { build_session }

  def skill_payload(**attrs)
    {
      'skill_id'           => 'sk-eng-001',
      'skill_label'        => 'Ruby on Rails',
      'level'              => 3,
      'confidence'         => 'high',
      'evidence'           => ['I profiled the N+1 query before fixing it'],
      'competency_summary' => 'Works independently on complex scope.'
    }.merge(attrs.transform_keys(&:to_s))
  end

  def run(response)
    described_class.new(session: session, gemini_client: InterviewRecords::FakeGemini.new(response)).call
  end

  describe 'happy path' do
    it 'stores configured and discovered skills and marks the portfolio complete' do
      add_coverage(session, 'Ruby on Rails', skill_id: 'sk-eng-001', state: 'covered', probe_count: 3)

      portfolio = run(
        'configured_skills' => [skill_payload],
        'discovered_skills' => [skill_payload('skill_id' => nil, 'skill_label' => 'Kafka', 'level' => 2)]
      )

      expect(portfolio.reload.generation_status).to eq('complete')
      expect(portfolio.portfolio_skills.order(:id).map { |s| [s.skill_label, s.ai_level, s.is_discovered] })
        .to eq([['Ruby on Rails', 3, false], ['Kafka', 2, true]])
    end

    it 'accepts a JSON string response' do
      portfolio = run({ 'configured_skills' => [skill_payload] }.to_json)

      expect(portfolio.portfolio_skills.count).to eq(1)
    end
  end

  describe 'normalizing model output' do
    it 'clamps and parses levels instead of failing the whole portfolio' do
      portfolio = run('configured_skills' => [
        skill_payload('skill_id' => 'a', 'skill_label' => 'A', 'level' => 'L4'),
        skill_payload('skill_id' => 'b', 'skill_label' => 'B', 'level' => 9),
        skill_payload('skill_id' => 'c', 'skill_label' => 'C', 'level' => nil),
        skill_payload('skill_id' => 'd', 'skill_label' => 'D', 'level' => 0)
      ])

      expect(portfolio.portfolio_skills.order(:skill_label).pluck(:ai_level)).to eq([4, 5, 1, 1])
    end

    it 'falls back to low confidence for unknown values and accepts any casing' do
      portfolio = run('configured_skills' => [
        skill_payload('skill_id' => 'a', 'skill_label' => 'A', 'confidence' => 'HIGH'),
        skill_payload('skill_id' => 'b', 'skill_label' => 'B', 'confidence' => 'very sure')
      ])

      expect(portfolio.portfolio_skills.order(:skill_label).pluck(:ai_confidence)).to eq(%w[high low])
    end

    it 'keeps at most three non-blank evidence quotes and fills a missing summary' do
      portfolio = run('configured_skills' => [
        skill_payload('evidence' => ['q1', '', 'q2', 'q3', 'q4'], 'competency_summary' => '')
      ])
      skill = portfolio.portfolio_skills.first

      expect(skill.evidence).to eq(%w[q1 q2 q3])
      expect(skill.competency_summary).to include('No competency summary')
    end

    it 'keeps very long model text intact' do
      long_summary = 'Detailed reasoning. ' * 500
      portfolio = run('configured_skills' => [skill_payload('competency_summary' => long_summary)])

      expect(portfolio.portfolio_skills.first.competency_summary).to eq(long_summary)
    end

    it 'skips rows that are not objects or have no label' do
      portfolio = run('configured_skills' => ['garbage', skill_payload('skill_id' => nil, 'skill_label' => '  ')],
                      'discovered_skills' => nil)

      expect(portfolio.reload.generation_status).to eq('complete')
      expect(portfolio.portfolio_skills).to be_empty
    end
  end

  describe 'unassessed skills' do
    it 'does not invent a rating for a configured skill the interview never reached' do
      add_coverage(session, 'Ruby on Rails', skill_id: 'sk-eng-001', state: 'covered', probe_count: 3)
      add_coverage(session, 'System Design', skill_id: 'sk-eng-002', state: 'not_yet', probe_count: 0)

      portfolio = run('configured_skills' => [
        skill_payload,
        skill_payload('skill_id' => 'sk-eng-002', 'skill_label' => 'System Design', 'level' => 1)
      ])

      expect(portfolio.portfolio_skills.pluck(:skill_label)).to eq(['Ruby on Rails'])
    end

    it 'still rates a skill that was at least initiated' do
      add_coverage(session, 'System Design', skill_id: 'sk-eng-002', state: 'initiated', probe_count: 1)

      portfolio = run('configured_skills' => [skill_payload('skill_id' => 'sk-eng-002', 'skill_label' => 'System Design')])

      expect(portfolio.portfolio_skills.pluck(:skill_label)).to eq(['System Design'])
    end
  end

  describe 'regeneration' do
    let!(:portfolio) { build_portfolio(session: session, status: 'failed') }

    it 'keeps assessor overrides for configured and discovered skills' do
      configured = add_portfolio_skill(portfolio, 'Ruby on Rails', skill_id: 'sk-eng-001', level: 2)
      discovered = add_portfolio_skill(portfolio, 'Kafka', discovered: true, level: 2)
      add_override(configured, level: 4, notes: 'Strong follow-up answers')
      add_override(discovered, level: 3)

      run('configured_skills' => [skill_payload('level' => 3)],
          'discovered_skills' => [skill_payload('skill_id' => nil, 'skill_label' => 'kafka ', 'level' => 1)])

      overrides = portfolio.reload.portfolio_skills.includes(:assessor_override)
                           .to_h { |s| [s.skill_label, s.assessor_override] }
      expect(overrides['Ruby on Rails']).to have_attributes(override_level: 4, ai_level: 3,
                                                            assessor_notes: 'Strong follow-up answers', overridden_by: 42)
      expect(overrides['kafka']).to have_attributes(override_level: 3, ai_level: 1)
    end

    it 'drops overrides only for skills the model no longer returns' do
      add_override(add_portfolio_skill(portfolio, 'Ruby on Rails', skill_id: 'sk-eng-001', level: 2), level: 4)

      run('configured_skills' => [skill_payload('skill_id' => 'sk-eng-009', 'skill_label' => 'Go')])

      expect(AssessorOverride.count).to eq(0)
      expect(portfolio.reload.portfolio_skills.pluck(:skill_label)).to eq(['Go'])
    end

    it 'rolls back completely when a row cannot be saved (no partial write, overrides intact)' do
      add_override(add_portfolio_skill(portfolio, 'Ruby on Rails', skill_id: 'sk-eng-001', level: 2), level: 4)
      too_long_label = 'x' * 300 # column limit is 255

      expect {
        run('configured_skills' => [skill_payload, skill_payload('skill_id' => 'sk-x', 'skill_label' => too_long_label)])
      }.to raise_error(ActiveRecord::ActiveRecordError)

      portfolio.reload
      expect(portfolio.generation_status).to eq('failed')
      expect(portfolio.portfolio_skills.map { |s| [s.skill_label, s.ai_level] }).to eq([['Ruby on Rails', 2]])
      expect(portfolio.portfolio_skills.first.assessor_override.override_level).to eq(4)
    end
  end

  describe 'failure paths' do
    it 'marks the portfolio failed and re-raises when the model call times out' do
      expect { run(Gemini::HttpClient::TimeoutError.new('timed out')) }.to raise_error(Gemini::HttpClient::TimeoutError)

      portfolio = session.reload.portfolio
      expect(portfolio.generation_status).to eq('failed')
      expect(portfolio.generation_error).to eq('timed out')
    end

    it 'marks the portfolio failed on malformed JSON' do
      expect { run('{not json') }.to raise_error(JSON::ParserError)

      expect(session.reload.portfolio.generation_status).to eq('failed')
    end

    it 'marks the portfolio failed when the JSON is not an object' do
      expect { run('[]') }.to raise_error(ArgumentError)

      expect(session.reload.portfolio.generation_status).to eq('failed')
    end
  end

  describe 'duplicate jobs' do
    it 'does not call the model or touch skills when the portfolio is already complete' do
      portfolio = build_portfolio(session: session, status: 'complete')
      add_override(add_portfolio_skill(portfolio, 'Ruby on Rails', level: 2), level: 4)
      gemini = InterviewRecords::FakeGemini.new('configured_skills' => [])

      described_class.new(session: session, gemini_client: gemini).call

      expect(gemini.calls).to eq(0)
      expect(portfolio.reload.portfolio_skills.count).to eq(1)
      expect(AssessorOverride.count).to eq(1)
    end
  end
end
