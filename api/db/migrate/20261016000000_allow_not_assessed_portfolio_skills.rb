# frozen_string_literal: true

# Lets a portfolio skill be "not assessed": no level, no confidence, no summary, and a reason
# (Step 4, Option B). It only relaxes constraints and adds nullable columns, so no existing row
# changes (AC-17). Ratings already stored stay as they are.
#
# Rollback (AC-18) restores the NOT NULL constraints only when no row depends on them; otherwise it
# stops and says how many rows would need a made-up value.
class AllowNotAssessedPortfolioSkills < ActiveRecord::Migration[7.0]
  REASONS = %w[not_reached insufficient_evidence omitted_by_model].freeze

  def up
    change_column_null :portfolio_skills, :ai_level, true
    change_column_null :portfolio_skills, :ai_confidence, true
    change_column_null :portfolio_skills, :competency_summary, true
    add_column :portfolio_skills, :not_assessed_reason, :string, limit: 30

    # The existing check (ai_level between 1 and 5) already lets NULL through.
    add_check_constraint :portfolio_skills,
                         "not_assessed_reason IS NULL OR not_assessed_reason IN (#{REASONS.map { "'#{_1}'" }.join(', ')})",
                         name: 'chk_portfolio_skills_not_assessed_reason'
    add_check_constraint :portfolio_skills, '(ai_level IS NULL) = (not_assessed_reason IS NOT NULL)',
                         name: 'chk_portfolio_skills_reason_iff_no_level'
    add_check_constraint :portfolio_skills, 'ai_level IS NOT NULL OR ai_confidence IS NULL',
                         name: 'chk_portfolio_skills_no_confidence_without_level'

    # An assessor can rate a skill the AI didn't (AC-20).
    change_column_null :assessor_overrides, :ai_level, true

    add_column :portfolios, :generation_error_category, :string, limit: 50
  end

  def down
    blocking = {
      'portfolio_skills without a level'      => count_nulls(:portfolio_skills, :ai_level),
      'portfolio_skills without a confidence' => count_nulls(:portfolio_skills, :ai_confidence),
      'portfolio_skills without a summary'    => count_nulls(:portfolio_skills, :competency_summary),
      'assessor_overrides without an AI level' => count_nulls(:assessor_overrides, :ai_level)
    }.select { |_, count| count.positive? }

    if blocking.any?
      raise ActiveRecord::IrreversibleMigration,
            "Can't restore NOT NULL without inventing values: #{blocking.map { |what, n| "#{n} #{what}" }.join(', ')}. " \
            'Decide what those rows should hold, then roll back.'
    end

    remove_column :portfolios, :generation_error_category
    change_column_null :assessor_overrides, :ai_level, false

    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_no_confidence_without_level'
    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_reason_iff_no_level'
    remove_check_constraint :portfolio_skills, name: 'chk_portfolio_skills_not_assessed_reason'
    remove_column :portfolio_skills, :not_assessed_reason
    change_column_null :portfolio_skills, :competency_summary, false
    change_column_null :portfolio_skills, :ai_confidence, false
    change_column_null :portfolio_skills, :ai_level, false
  end

  private

  def count_nulls(table, column)
    select_value("SELECT COUNT(*) FROM #{quote_table_name(table)} WHERE #{quote_column_name(column)} IS NULL").to_i
  end
end
