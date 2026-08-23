# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  let(:session) { create(:session) }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:generator) { described_class.new(session: session) }

  it 'clamps level to 1..5 and defaults invalid confidence to medium' do
    response = {
      'configured_skills' => [
        {
          'skill_label' => 'Ruby',
          'level' => 10,
          'confidence' => 'BOGUS',
          'competency_summary' => 'Strong developer.'
        }
      ]
    }

    generator.send(:save_skills, portfolio, response)
    ps = portfolio.portfolio_skills.first

    expect(ps.ai_level).to eq(5)
    expect(ps.ai_confidence).to eq('medium')
  end

  it 'skips skills with blank competency summary to prevent DB constraint violation' do
    response = {
      'configured_skills' => [
        {
          'skill_label' => 'Ruby',
          'level' => 3,
          'confidence' => 'high',
          'competency_summary' => ''
        }
      ]
    }

    expect { generator.send(:save_skills, portfolio, response) }.not_to change(PortfolioSkill, :count)
  end
end
