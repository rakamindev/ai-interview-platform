# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioSkill do
  it 'is valid with factory attributes' do
    expect(build(:portfolio_skill)).to be_valid
  end

  it 'requires ai_level within 1..5' do
    skill = build(:portfolio_skill, ai_level: 6)

    expect(skill).not_to be_valid
    expect(skill.errors[:ai_level]).to be_present
  end

  it 'requires a known confidence level' do
    expect(build(:portfolio_skill, ai_confidence: 'certain')).not_to be_valid
  end

  it 'exposes evidence as an array of quotes' do
    skill = build(:portfolio_skill, evidence: ['quote one', 'quote two'])

    expect(skill.evidence_quotes).to eq(['quote one', 'quote two'])
  end

  it 'treats a nil evidence column as an empty list' do
    expect(build(:portfolio_skill, evidence: nil).evidence_quotes).to eq([])
  end
end
