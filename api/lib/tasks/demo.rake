# frozen_string_literal: true

namespace :db do
  namespace :seed do
    desc 'Seed a complete demo assessment: session, transcript, coverage, portfolio, override and vacancy'
    task demo: :environment do
      load Rails.root.join('db/seeds/demo.rb')
    end
  end
end
