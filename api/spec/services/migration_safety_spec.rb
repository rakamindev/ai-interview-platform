require 'rails_helper'
require Rails.root.join('db/migrate/20260923000000_allow_unassessed_portfolio_levels')

RSpec.describe AllowUnassessedPortfolioLevels do
  it 'refuses a destructive rollback when unassessed ratings exist' do
    portfolio = portfolio_for(assessment_session(organization))
    skill = skill_for(portfolio, ai_level: nil)
    expect { described_class.new.down }.to raise_error(ActiveRecord::IrreversibleMigration)
    expect(skill.reload.ai_level).to be_nil
  end
end
