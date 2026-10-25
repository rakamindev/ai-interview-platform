namespace :portfolios do
  desc 'Mark all complete portfolios as reviewed (retroactive)'
  task retroactive_mark_reviewed: :environment do
    count = Portfolio.where(generation_status: 'complete', reviewed_at: nil).update_all('reviewed_at = generated_at')
    puts "Marked #{count} portfolios as reviewed."
  end
end