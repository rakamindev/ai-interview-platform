# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioSkill do
  it 'requires a level when the skill is assessed' do
    expect(build(:portfolio_skill, ai_level: nil)).not_to be_valid
  end

  it 'does not allow a level when the skill was not assessed' do
    expect(build(:portfolio_skill, :not_assessed, ai_level: 1)).not_to be_valid
  end

  it 'is enforced by the database even when validations are skipped' do
    skill = create(:portfolio_skill)

    expect { skill.update_columns(ai_level: nil) }.to raise_error(ActiveRecord::StatementInvalid, /level_matches_status/)
  end
end
