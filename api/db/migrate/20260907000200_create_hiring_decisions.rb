# frozen_string_literal: true

# The product produces a rating and then stops. What happened to the candidate
# lives in somebody's spreadsheet, which means the one question anyone asks
# afterwards, "why was this person rejected", has no answer inside the system
# that produced the reason.
#
# Two constraints are enforced here rather than only in Ruby, because a record
# that exists to be trusted later cannot depend on the application being the
# only writer:
#
#   * one decision per portfolio, so a candidate cannot quietly be decided twice
#   * a rationale with something in it, so a decision cannot be rubber-stamped
#
# `levels_at_decision` is the part that matters most, and it is here because of
# a defect found earlier in this work: regenerating a portfolio destroys and
# rewrites its skills, and an assessor's override with them. A decision that
# merely points at the portfolio would silently change meaning the next time
# that happened. Storing what the ratings actually said at the moment someone
# acted on them is what makes this an audit trail rather than a foreign key.
#
# Safe against existing rows: a new table, referenced by nothing.
class CreateHiringDecisions < ActiveRecord::Migration[7.0]
  def change
    create_table :hiring_decisions do |t|
      t.bigint :portfolio_id, null: false
      t.string :decision,     null: false, limit: 20
      t.text   :rationale,    null: false

      # The reading the decision was made on, frozen. Not derived later.
      t.jsonb  :levels_at_decision, null: false, default: {}

      t.bigint   :decided_by, null: false
      t.datetime :decided_at, null: false, default: -> { 'now()' }
      t.string   :ip_address, limit: 45
      t.string   :user_agent, limit: 255

      t.timestamps
    end

    add_index :hiring_decisions, :portfolio_id, unique: true
    add_foreign_key :hiring_decisions, :portfolios

    execute <<~SQL
      ALTER TABLE ai_interview.hiring_decisions
        ADD CONSTRAINT chk_hiring_decisions_decision
        CHECK (decision IN ('advance', 'hold', 'reject'));

      ALTER TABLE ai_interview.hiring_decisions
        ADD CONSTRAINT chk_hiring_decisions_rationale
        CHECK (char_length(btrim(rationale)) >= 20);
    SQL
  end
end
