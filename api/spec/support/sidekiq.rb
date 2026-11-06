# frozen_string_literal: true

require 'sidekiq/testing'

# Job Sidekiq tidak dijalankan sungguhan saat tes; cukup masuk antrean palsu
# sehingga tes bisa memeriksa "job X di-enqueue" tanpa Redis dan tanpa Gemini.
Sidekiq::Testing.fake!

RSpec.configure do |config|
  config.before { Sidekiq::Worker.clear_all }
end
