# frozen_string_literal: true

require 'rails_helper'
require Rails.root.join('db/migrate/20261016000000_allow_not_assessed_portfolio_skills')

# AC-17: running the migration changes no stored row. AC-18: rolling it back works while no row
# depends on it, and otherwise stops instead of inventing values.
# Postgres DDL is transactional, so each example's schema changes roll back with it.
RSpec.describe AllowNotAssessedPortfolioSkills do
  let(:migration) { described_class.new }
  let!(:rated)    { create(:portfolio_skill, ai_level: 2, ai_confidence: 'medium', competency_summary: 'Solid.') }
  let!(:override) { create(:assessor_override, portfolio_skill: rated, override_level: 4) }

  def migrate(direction)
    ActiveRecord::Migration.suppress_messages { migration.migrate(direction) }
  ensure
    [PortfolioSkill, AssessorOverride, Portfolio].each(&:reset_column_information)
  end

  def nullable?(table, column) = ActiveRecord::Base.connection.columns(table).find { _1.name == column }.null

  def stored_rows
    conn = ActiveRecord::Base.connection
    {
      skills:    conn.select_rows('SELECT id, ai_level, ai_confidence, competency_summary, evidence FROM portfolio_skills ORDER BY id'),
      overrides: conn.select_rows('SELECT id, ai_level, override_level FROM assessor_overrides ORDER BY id')
    }
  end

  it 'rolls back and re-applies without changing any stored rating' do
    before = stored_rows

    migrate(:down)
    expect(nullable?('portfolio_skills', 'ai_level')).to be(false)
    expect(nullable?('assessor_overrides', 'ai_level')).to be(false)
    expect(stored_rows).to eq(before)

    migrate(:up)
    expect(nullable?('portfolio_skills', 'ai_level')).to be(true)
    expect(nullable?('portfolio_skills', 'ai_confidence')).to be(true)
    expect(nullable?('portfolio_skills', 'competency_summary')).to be(true)
    expect(nullable?('assessor_overrides', 'ai_level')).to be(true)
    expect(stored_rows).to eq(before)
  end

  it 'refuses to roll back while a skill has no level, and says how many' do
    unrated = create(:portfolio_skill)
    unrated.update_columns(ai_level: nil, ai_confidence: nil, competency_summary: nil, not_assessed_reason: 'not_reached')

    expect { migrate(:down) }.to raise_error(ActiveRecord::IrreversibleMigration, /1 portfolio_skills without a level/)

    expect(nullable?('portfolio_skills', 'ai_level')).to be(true)
    expect(unrated.reload.ai_level).to be_nil
  end

  it 'enforces that a skill has a reason exactly when it has no level' do
    expect { rated.update_columns(not_assessed_reason: 'not_reached') }.to raise_error(ActiveRecord::StatementInvalid)
    expect { rated.update_columns(ai_level: nil, ai_confidence: nil) }.to raise_error(ActiveRecord::StatementInvalid)
  end
end
