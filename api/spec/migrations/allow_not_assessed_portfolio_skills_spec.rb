# frozen_string_literal: true

require 'rails_helper'
require Rails.root.join('db/migrate/20261024000001_allow_not_assessed_portfolio_skills')
require Rails.root.join('db/migrate/20261024000003_add_override_history')

# The test database is already migrated; each example runs the migration
# down and up inside the example transaction (Postgres DDL is transactional).
RSpec.describe AllowNotAssessedPortfolioSkills do
  let(:migration)  { described_class.new }
  let(:connection) { ActiveRecord::Base.connection }

  around do |example|
    ActiveRecord::Migration.suppress_messages { example.run }
  ensure
    PortfolioSkill.reset_column_information
  end

  it 'refuses to roll back while not-assessed skills exist, instead of coercing them to a level' do
    create(:portfolio_skill, ai_level: nil, ai_confidence: nil, rating_status: 'not_assessed',
                             not_assessed_reason: 'not_covered', evidence: [])

    expect { migration.migrate(:down) }.to raise_error(ActiveRecord::IrreversibleMigration, /1 not-assessed/)
  end

  it 'keeps legacy rows assessed and backfills the coverage snapshot from coverage maps' do
    # Later migrations depend on this one, so they are rolled back first and
    # re-applied afterwards, in the same order as a real deploy.
    later = AddOverrideHistory.new
    later.migrate(:down)
    migration.migrate(:down)
    PortfolioSkill.reset_column_information
    portfolio = create(:portfolio)
    create(:coverage_map, session: portfolio.session, skill_label: 'Ruby on Rails', state: 'partial', probe_count: 2)
    connection.execute(<<~SQL)
      INSERT INTO portfolio_skills (portfolio_id, skill_label, ai_level, ai_confidence, competency_summary)
      VALUES (#{portfolio.id}, 'ruby on rails', 1, 'high', 'Contoh legacy.')
    SQL

    migration.migrate(:up)
    later.migrate(:up)
    PortfolioSkill.reset_column_information

    expect(PortfolioSkill.find_by!(portfolio_id: portfolio.id))
      .to have_attributes(rating_status: 'assessed', ai_level: 1, not_assessed_reason: nil,
                          coverage_state: 'partial', probe_count: 2)
  end

  it 'rejects a not-assessed row that still carries a level' do
    expect do
      create(:portfolio_skill, ai_level: 3, rating_status: 'not_assessed', not_assessed_reason: 'not_covered')
    end.to raise_error(ActiveRecord::RecordInvalid)
  end
end
