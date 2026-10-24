# frozen_string_literal: true

# Interview content and invite credentials must not appear in Rails request logs.
Rails.application.config.filter_parameters += %i[
  password token invite_token authorization api_key
  email candidate_id candidate_name text transcript
  evidence evidence_quotes assessor_notes system_prompt
  scope_include scope_exclude culture_dimensions competency_expectations
]
