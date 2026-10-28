# frozen_string_literal: true

require 'rails_helper'
require Rails.root.join('db/migrate/20261024000003_add_override_history')

RSpec.describe AddOverrideHistory do
  let(:migration)  { described_class.new }
  let(:connection) { ActiveRecord::Base.connection }

  around do |example|
    ActiveRecord::Migration.suppress_messages { example.run }
  ensure
    [PortfolioSkill, AssessorOverride].each(&:reset_column_information)
  end

  def insert_skill(portfolio, label, skill_id: nil)
    connection.select_value(<<~SQL)
      INSERT INTO portfolio_skills (portfolio_id, skill_id, skill_label, ai_level, ai_confidence, competency_summary)
      VALUES (#{portfolio.id}, #{skill_id ? "'#{skill_id}'" : 'NULL'}, '#{label}', 2, 'medium', 'Contoh.') RETURNING id
    SQL
  end

  # AC-29: existing overrides get exactly one "set" event; nothing is lost.
  it 'backfills one set event per existing override and marks overrides without a note' do
    migration.migrate(:down)
    [PortfolioSkill, AssessorOverride].each(&:reset_column_information)
    portfolio = create(:portfolio)
    with_note    = insert_skill(portfolio, 'Ruby on Rails')
    without_note = insert_skill(portfolio, 'API Design')
    connection.execute(<<~SQL)
      INSERT INTO assessor_overrides (portfolio_skill_id, ai_level, override_level, assessor_notes, overridden_by)
      VALUES (#{with_note}, 2, 3, 'Contoh catatan.', 7), (#{without_note}, 2, 1, NULL, 8)
    SQL

    migration.migrate(:up)
    [PortfolioSkill, AssessorOverride].each(&:reset_column_information)

    expect(AssessorOverrideEvent.order(:portfolio_skill_id).pluck(:portfolio_skill_id, :action, :from_level, :to_level, :notes, :actor_id))
      .to eq([[with_note, 'set', 2, 3, 'Contoh catatan.', 7],
              [without_note, 'set', 2, 1, '[legacy override, no note recorded]', 8]])
    expect(AssessorOverride.count).to eq(2)
  end

  it 'backfills a stable skill key from the skill id, else from the normalised label' do
    migration.migrate(:down)
    PortfolioSkill.reset_column_information
    portfolio = create(:portfolio)
    by_id    = insert_skill(portfolio, 'Ruby on Rails', skill_id: 'SK-ENG-001')
    by_label = insert_skill(portfolio, '  API   Design ')

    migration.migrate(:up)
    PortfolioSkill.reset_column_information

    expect(PortfolioSkill.find(by_id).skill_key).to eq('id:sk-eng-001')
    expect(PortfolioSkill.find(by_label).skill_key).to eq('label:api design')
  end

  it 'aborts instead of silently merging skills that would get the same key' do
    migration.migrate(:down)
    PortfolioSkill.reset_column_information
    portfolio = create(:portfolio)
    insert_skill(portfolio, 'API Design')
    insert_skill(portfolio, 'api design')

    expect { migration.migrate(:up) }.to raise_error(StandardError, /duplicate skill keys/)
  end
end
