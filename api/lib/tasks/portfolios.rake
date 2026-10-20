# frozen_string_literal: true

namespace :portfolios do
  # Step 4, "Existing data": ratings stored before the not-assessed state existed are not rewritten, because
  # people may have acted on them. This only counts the ones that look fabricated, so the team can decide.
  desc 'Read-only: count L1 ratings stored for configured skills the interview never probed'
  task unprobed_ratings: :environment do
    rows = PortfolioSkill
           .joins(portfolio: :session)
           .joins(<<~SQL.squish)
             JOIN coverage_maps ON coverage_maps.session_id = sessions.id
              AND (coverage_maps.skill_id = portfolio_skills.skill_id OR coverage_maps.skill_label = portfolio_skills.skill_label)
           SQL
           .where(ai_level: 1, is_discovered: false, coverage_maps: { state: 'not_yet' })
           .distinct

    found = rows.pluck('sessions.tenant_id', 'portfolios.id', 'portfolio_skills.skill_label')
    count = found.size

    puts "#{count} L1 #{count == 1 ? 'rating for a skill' : 'ratings for skills'} the interview never probed."
    # Ids and skill names only: no candidate names, quotes or summaries.
    found.each { |tenant_id, portfolio_id, label| puts "  tenant #{tenant_id}, portfolio #{portfolio_id}: #{label}" }
    puts 'Nothing was changed.'
  end
end
