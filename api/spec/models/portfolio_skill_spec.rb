# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioSkill do
  describe 'validation' do
    it 'needs a level from 1 to 5 when the skill is rated' do
      %w[assessed thin_evidence].each do |status|
        expect(build(:portfolio_skill, status: status, ai_level: nil)).not_to be_valid
        expect(build(:portfolio_skill, status: status, ai_level: 6)).not_to be_valid
      end
    end

    it 'allows no level, confidence or summary when the skill was not rated' do
      %w[not_assessed unavailable].each do |status|
        skill = build(:portfolio_skill, status: status, ai_level: nil, ai_confidence: nil, competency_summary: nil)

        expect(skill).to be_valid, "#{status}: #{skill.errors.full_messages.to_sentence}"
      end
    end

    it 'has no default status, so nothing is marked as assessed by accident' do
      expect(described_class.new.status).to be_nil
      expect(build(:portfolio_skill, status: nil)).not_to be_valid
    end
  end

  describe 'the database' do
    it 'refuses a rated skill without a level, even when validation is skipped' do
      skill = build(:portfolio_skill, status: 'assessed', ai_level: nil)

      expect { skill.save!(validate: false) }
        .to raise_error(ActiveRecord::StatementInvalid, /chk_portfolio_skills_rated_level/)
    end

    it 'refuses an unknown status' do
      skill = build(:portfolio_skill, status: 'excellent')

      expect { skill.save!(validate: false) }
        .to raise_error(ActiveRecord::StatementInvalid, /chk_portfolio_skills_status/)
    end
  end

  describe '#rated_level' do
    it 'is the level of a rated skill' do
      expect(build(:portfolio_skill, status: 'thin_evidence', ai_level: 2).rated_level).to eq(2)
    end

    it 'is nil for a skill that was not rated, even when an older row still holds a number' do
      expect(build(:portfolio_skill, status: 'not_assessed', ai_level: 1).rated_level).to be_nil
    end
  end
end
