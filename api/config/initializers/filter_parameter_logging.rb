# frozen_string_literal: true

# Keeps credentials and personal data out of request logs and SQL logs. Rails applies this list to
# ActiveRecord bind values too, and matches partially (:name also covers candidate_name).
Rails.application.config.filter_parameters += %i[password email name company message]
