# frozen_string_literal: true

require 'spec_helper'
ENV['RAILS_ENV'] ||= 'test'
require_relative '../config/environment'

abort('The Rails environment is running in production mode!') if Rails.env.production?
require 'rspec/rails'

# begin
#   ActiveRecord::Migration.maintain_test_schema!
# rescue ActiveRecord::PendingMigrationError => e
#   abort e.to_s.strip
# rescue StandardError
#   # Allow running specs even if database is not fully loaded locally yet
# end

if ActiveRecord::Base.connection.adapter_name.downcase.include?('sqlite')
  ActiveRecord::Schema.define do
    create_table :organizations, force: true do |t|
      t.string :name
      t.string :scheme
      t.string :identifier
      t.string :host
      t.timestamps
    end

    create_table :assessments, force: true do |t|
      t.bigint :tenant_id
      t.bigint :created_by
      t.string :name
      t.integer :time_limit_min
      t.text :system_prompt
      t.string :language, default: 'en'
      t.timestamps
    end

    create_table :sessions, force: true do |t|
      t.bigint :tenant_id
      t.bigint :assessment_id
      t.bigint :candidate_id
      t.string :candidate_name
      t.string :invite_token
      t.string :status, default: 'pending'
      t.string :end_reason
      t.datetime :started_at
      t.datetime :ended_at
      t.integer :duration_seconds
      t.datetime :consent_given_at
      t.string :consent_version
      t.boolean :pdp_retention_acknowledged, default: false
      t.timestamps
    end

    create_table :portfolios, force: true do |t|
      t.bigint :session_id
      t.bigint :candidate_id
      t.string :generation_status, default: 'pending'
      t.timestamps
    end

    create_table :portfolio_skills, force: true do |t|
      t.bigint :portfolio_id
      t.string :skill_id
      t.string :skill_label
      t.boolean :is_discovered, default: false
      t.integer :ai_level
      t.string :ai_confidence
      t.text :competency_summary
      t.text :evidence
    end

    create_table :assessor_overrides, force: true do |t|
      t.bigint :portfolio_skill_id
      t.integer :ai_level
      t.integer :override_level
      t.text :assessor_notes
      t.bigint :overridden_by
      t.datetime :overridden_at
    end
  end
end

RSpec.configure do |config|
  config.use_transactional_fixtures = true
  config.infer_spec_type_from_file_location!
  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods if defined?(FactoryBot)
end
