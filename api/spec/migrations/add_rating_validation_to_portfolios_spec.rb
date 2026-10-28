# frozen_string_literal: true

require 'rails_helper'
require Rails.root.join('db/migrate/20261024000002_add_rating_validation_to_portfolios')

RSpec.describe AddRatingValidationToPortfolios do
  let(:migration) { described_class.new }

  around do |example|
    ActiveRecord::Migration.suppress_messages { example.run }
  ensure
    Portfolio.reset_column_information
  end

  # AC-14: portfolios generated before validation existed may contain coerced
  # L1/L5 ratings that cannot be told apart from real ones, so they are flagged.
  it 'flags portfolios that existed before the migration and validates new ones by default' do
    session = create(:session)
    migration.migrate(:down)
    Portfolio.reset_column_information
    # The model already validates the new columns, so the legacy row is inserted directly.
    legacy_id = ActiveRecord::Base.connection.select_value(<<~SQL)
      INSERT INTO portfolios (session_id, generation_status) VALUES (#{session.id}, 'complete') RETURNING id
    SQL

    migration.migrate(:up)
    Portfolio.reset_column_information

    expect(Portfolio.find(legacy_id).ratings_validated).to be(false)
    expect(create(:portfolio).ratings_validated).to be(true)
  end
end
