# frozen_string_literal: true

# Production refuses to boot without a paid model tier and a server-set login company (see ProductionGuards).
Rails.application.config.after_initialize do
  ProductionGuards.check! if Rails.env.production?
end
