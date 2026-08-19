# frozen_string_literal: true

namespace :portfolios do
  desc "Re-enqueue generation for portfolios stuck in 'pending'/'generating' past the recovery TTL"
  task recover: :environment do
    recovered = Portfolios::Recovery.new.recover!
    Rails.logger.info("[Recovery] Sweep finished: #{recovered.size} portfolio(s) re-enqueued")
    puts "Recovered #{recovered.size} portfolio(s)"
  end
end