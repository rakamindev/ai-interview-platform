# frozen_string_literal: true

# Keep candidate personal data and credentials out of request logs
# (UU PDP data minimisation). Partial matches: e.g. :token also filters
# invite_token and resumption tokens.
Rails.application.config.filter_parameters += %i[
  password token secret api_key authorization
  candidate_name email text transcript evidence assessor_notes competency_summary
]
