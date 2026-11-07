# frozen_string_literal: true

# Links every existing portfolio that already has skills to a single "legacy_backfill" generation,
# marks it current, and gives its skills a stable skill_key. Uses SQL only, so later model changes
# cannot break this migration. Reversible: down removes only what up created.
class BackfillPortfolioGenerations < ActiveRecord::Migration[7.0]
  def up
    execute <<~SQL
      INSERT INTO portfolio_generations (portfolio_id, sequence, status, source, queued_at, started_at, finished_at)
      SELECT p.id, 1, 'succeeded', 'legacy_backfill',
             COALESCE(p.generated_at, now()), p.generated_at, p.generated_at
      FROM portfolios p
      WHERE EXISTS (SELECT 1 FROM portfolio_skills ps WHERE ps.portfolio_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM portfolio_generations g WHERE g.portfolio_id = p.id);
    SQL

    execute <<~SQL
      UPDATE portfolios p
      SET current_generation_id = g.id
      FROM portfolio_generations g
      WHERE g.portfolio_id = p.id AND g.source = 'legacy_backfill' AND p.current_generation_id IS NULL;
    SQL

    execute <<~SQL
      UPDATE portfolio_skills ps
      SET generation_id = g.id
      FROM portfolio_generations g
      WHERE g.portfolio_id = ps.portfolio_id AND g.source = 'legacy_backfill' AND ps.generation_id IS NULL;
    SQL

    # Configured skills: key by the assessment skill they were configured from (matched on label).
    execute <<~SQL
      UPDATE portfolio_skills ps
      SET skill_key = 'assessment_skill:' || ask.id
      FROM portfolios p
      JOIN sessions s ON s.id = p.session_id
      JOIN assessment_skills ask ON ask.assessment_id = s.assessment_id
      WHERE ps.portfolio_id = p.id AND ps.is_discovered = false AND ps.skill_key IS NULL
        AND lower(ask.skill_label) = lower(ps.skill_label)
        AND NOT EXISTS (
          SELECT 1 FROM portfolio_skills earlier
          WHERE earlier.generation_id = ps.generation_id AND earlier.id < ps.id
            AND earlier.is_discovered = false
            AND lower(earlier.skill_label) = lower(ask.skill_label)
        );
    SQL

    # Later configured duplicates fall through here too. Compare the final prefixed,
    # normalised key, not the raw label: C++/C# and all-symbol labels can collide.
    execute <<~SQL
      UPDATE portfolio_skills ps
      SET skill_key = (CASE WHEN ps.is_discovered THEN 'discovered:' ELSE 'label:' END)
                      || trim(regexp_replace(lower(ps.skill_label), '[^a-z0-9]+', ' ', 'g'))
                      || CASE WHEN EXISTS (
                           SELECT 1 FROM portfolio_skills earlier
                           WHERE earlier.generation_id = ps.generation_id AND earlier.id < ps.id
                             AND COALESCE(earlier.skill_key,
                                   (CASE WHEN earlier.is_discovered THEN 'discovered:' ELSE 'label:' END)
                                   || trim(regexp_replace(lower(earlier.skill_label), '[^a-z0-9]+', ' ', 'g')))
                                 = (CASE WHEN ps.is_discovered THEN 'discovered:' ELSE 'label:' END)
                                   || trim(regexp_replace(lower(ps.skill_label), '[^a-z0-9]+', ' ', 'g'))
                         ) THEN ':' || ps.id ELSE '' END
      WHERE ps.skill_key IS NULL;
    SQL

  end

  def down
    # Once real (non-backfill) generations exist, portfolios hold history the old schema cannot
    # represent: rolling back would show every generation's skills as current. Refuse instead of
    # silently mixing them; an operator must decide what to keep.
    real = select_value("SELECT count(*) FROM portfolio_generations WHERE source <> 'legacy_backfill'").to_i
    if real.positive?
      raise ActiveRecord::IrreversibleMigration,
            "#{real} non-backfill portfolio generations exist; rolling back would merge their skills. " \
            'Keep only current-generation skills manually before rolling back.'
    end

    execute "UPDATE portfolio_skills SET generation_id = NULL, skill_key = NULL WHERE generation_id IN (SELECT id FROM portfolio_generations WHERE source = 'legacy_backfill')"
    execute "UPDATE portfolios SET current_generation_id = NULL WHERE current_generation_id IN (SELECT id FROM portfolio_generations WHERE source = 'legacy_backfill')"
    execute "DELETE FROM portfolio_generations WHERE source = 'legacy_backfill'"
  end
end
