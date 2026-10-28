# frozen_string_literal: true

# ratings_validated: portfolios generated before rating validation existed may
# contain levels coerced to L1/L5 that cannot be told apart from real ones, so
# every existing row is flagged false and shown with a notice; their levels are
# not changed. New portfolios default to true.
#
# generation_error_code: a safe, enumerable failure reason for the API, so the
# raw exception text no longer has to be sent to clients.
#
# generation_claimed_at: when a job claimed the portfolio for generation, so a
# claim left behind by a killed job can expire instead of locking it forever.
class AddRatingValidationToPortfolios < ActiveRecord::Migration[7.0]
  ERROR_CODES = %w[timeout rate_limited provider_denied provider_unavailable
                   invalid_output empty_output unknown].freeze

  def up
    add_column :portfolios, :ratings_validated, :boolean
    execute 'UPDATE portfolios SET ratings_validated = FALSE'
    change_column_default :portfolios, :ratings_validated, from: nil, to: true
    change_column_null :portfolios, :ratings_validated, false

    add_column :portfolios, :generation_error_code, :string, limit: 40
    add_check_constraint :portfolios,
                         "generation_error_code IS NULL OR generation_error_code IN " \
                         "(#{ERROR_CODES.map { |c| "'#{c}'" }.join(', ')})",
                         name: 'chk_portfolios_generation_error_code'

    add_column :portfolios, :generation_claimed_at, :datetime
  end

  def down
    remove_column :portfolios, :generation_claimed_at
    remove_check_constraint :portfolios, name: 'chk_portfolios_generation_error_code'
    remove_column :portfolios, :generation_error_code
    remove_column :portfolios, :ratings_validated
  end
end
