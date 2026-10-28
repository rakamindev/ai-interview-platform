# frozen_string_literal: true

require 'rails_helper'
require Rails.root.join('db/migrate/20261028000001_add_assessment_outcome_to_portfolio_skills')

# PostgreSQL DDL is transactional, so migrating down and up inside the example
# is rolled back with everything else when it finishes.
RSpec.describe AddAssessmentOutcomeToPortfolioSkills do
  let(:migration) { described_class.new.tap { |m| m.verbose = false } }
  let(:connection) { ActiveRecord::Base.connection }
  let(:portfolio) do
    org = create_organization('acme')
    as_tenant(org) { create(:portfolio) }
  end

  def reset_models
    [PortfolioSkill, AssessorOverride, Portfolio].each(&:reset_column_information)
  end

  after { reset_models }

  it 'keeps existing rows intact and marks them assessed' do
    migration.migrate(:down)
    reset_models
    connection.execute(<<~SQL)
      INSERT INTO portfolio_skills (portfolio_id, skill_label, ai_level, ai_confidence, competency_summary)
      VALUES (#{portfolio.id}, 'Legacy skill', 4, 'medium', 'Rated before this change')
    SQL

    migration.migrate(:up)
    reset_models

    expect(PortfolioSkill.find_by(skill_label: 'Legacy skill')).to have_attributes(
      ai_level: 4, ai_confidence: 'medium', assessment_status: 'assessed', evidence_refs: [], unverified_evidence_count: 0
    )
  end

  it 'rejects rows that claim to be assessed without a level' do
    expect do
      connection.execute(<<~SQL)
        INSERT INTO portfolio_skills (portfolio_id, skill_label, assessment_status, competency_summary)
        VALUES (#{portfolio.id}, 'Bad', 'assessed', 'x')
      SQL
    end.to raise_error(ActiveRecord::StatementInvalid, /chk_portfolio_skills_outcome/)
  end

  it 'rolls back cleanly when only assessed rows exist' do
    create(:portfolio_skill, portfolio:)

    expect { migration.migrate(:down) }.not_to raise_error
    expect(connection.column_exists?(:portfolio_skills, :assessment_status)).to be(false)
    expect(connection.columns(:portfolio_skills).find { |c| c.name == 'ai_level' }.null).to be(false)
  end

  it 'refuses to roll back when not-assessed rows exist instead of inventing levels' do
    create(:portfolio_skill, :not_assessed, portfolio:)

    expect { migration.migrate(:down) }.to raise_error(ActiveRecord::IrreversibleMigration, /1 not-assessed rows exist/)
  end
end
