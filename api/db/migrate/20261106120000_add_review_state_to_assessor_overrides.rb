# frozen_string_literal: true

# G3: an assessor override survives regeneration. When a new generation is published the override is
# moved to the skill with the same identity (skill_key) and flagged for review if the AI's level
# changed; if that skill no longer exists the override is kept, flagged, and never re-attached to a
# different skill. Additive and reversible; existing overrides keep their meaning.
class AddReviewStateToAssessorOverrides < ActiveRecord::Migration[7.0]
  def up
    add_column :assessor_overrides, :needs_review, :boolean, null: false, default: false
    add_column :assessor_overrides, :review_reason, :string
    # Which report the assessor first corrected this skill on (set once, never changed) ...
    add_reference :assessor_overrides, :first_made_on_generation,
                  foreign_key: { to_table: :portfolio_generations }, null: true
    # ... and which report the latest decision was made against (updated on every save).
    add_reference :assessor_overrides, :last_decided_on_generation,
                  foreign_key: { to_table: :portfolio_generations }, null: true

    # Existing overrides were made, and last decided, on the generation their skill belongs to.
    execute <<~SQL
      UPDATE assessor_overrides ao
      SET first_made_on_generation_id = ps.generation_id, last_decided_on_generation_id = ps.generation_id
      FROM portfolio_skills ps
      WHERE ps.id = ao.portfolio_skill_id AND ao.first_made_on_generation_id IS NULL;
    SQL
  end

  def down
    remove_reference :assessor_overrides, :last_decided_on_generation, foreign_key: { to_table: :portfolio_generations }
    remove_reference :assessor_overrides, :first_made_on_generation, foreign_key: { to_table: :portfolio_generations }
    remove_column :assessor_overrides, :review_reason
    remove_column :assessor_overrides, :needs_review
  end
end
