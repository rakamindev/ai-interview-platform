# frozen_string_literal: true

namespace :portfolios do
  desc 'Mark never-probed skills in old portfolios as not assessed. Dry run unless APPLY=1.'
  task repair_legacy_levels: :environment do
    apply  = ENV['APPLY'] == '1'
    result = Portfolios::LegacyLevelRepair.new(apply:, logger: Logger.new($stdout)).call

    puts "#{apply ? 'Repaired' : 'Would repair'} #{result.skill_ids.size} skills in #{result.portfolio_ids.size} portfolios."
    puts 'Run again with APPLY=1 to write the changes.' unless apply
  end
end
