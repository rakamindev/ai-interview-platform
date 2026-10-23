# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:session)   { create(:session) }
  let(:portfolio) { create(:portfolio, session: session, generation_status: 'pending') }

  def skill(label, level, confidence = 'high', summary: 'Works independently.')
    { 'skill_label' => label, 'level' => level, 'confidence' => confidence,
      'evidence' => ['I added an index.'], 'competency_summary' => summary }
  end

  def generate(configured)
    gemini = double('Gemini', generate_content: { 'configured_skills' => configured, 'discovered_skills' => [] })
    described_class.new(session: session.reload, gemini_client: gemini).call
  end

  before { portfolio }

  describe 'ratings the model did not give properly' do
    it 'drops a skill with a missing or out-of-range level instead of storing L1' do
      generate([skill('SQL', nil), skill('Go', 'seven'), skill('Rust', 9), skill('Java', 0), skill('Ruby', 3)])

      expect(portfolio.reload.portfolio_skills.pluck(:skill_label, :ai_level)).to eq([['Ruby', 3]])
    end

    it 'accepts a level written as "L4"' do
      generate([skill('SQL', 'L4')])

      expect(portfolio.reload.portfolio_skills.sole.ai_level).to eq(4)
    end

    it 'normalises confidence, treating an unknown value as low (not enough evidence)' do
      generate([skill('SQL', 3, 'HIGH'), skill('Go', 3, 'sure'), skill('Rust', 3, nil)])

      expect(portfolio.reload.portfolio_skills.order(:id).pluck(:ai_confidence)).to eq(%w[high low low])
    end
  end

  describe 'when writing the new skills fails part-way' do
    before { create(:portfolio_skill, portfolio: portfolio, skill_label: 'Previous', ai_level: 2) }

    it 'keeps the previous skills, marks the portfolio failed, and stores no model or candidate text' do
      expect { generate([skill('SQL', 3), skill('Go', 3, summary: '')]) }.to raise_error(ActiveRecord::RecordInvalid)

      portfolio.reload
      expect(portfolio.portfolio_skills.pluck(:skill_label)).to eq(['Previous'])
      expect(portfolio.generation_status).to eq('failed')
      expect(portfolio.generation_error).to eq('ActiveRecord::RecordInvalid')
    end
  end

  it 'completes and replaces the previous skills on success' do
    create(:portfolio_skill, portfolio: portfolio, skill_label: 'Previous')

    generate([skill('SQL', 3)])

    expect(portfolio.reload).to be_complete
    expect(portfolio.portfolio_skills.pluck(:skill_label)).to eq(['SQL'])
  end
end
