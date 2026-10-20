# frozen_string_literal: true

# Candidate-derived values must never reach the logs. The defaults are kept and
# the interview payload fields are added: a request that carries a name, notes,
# transcript, evidence quotes, a competency summary or a compiled system prompt
# is logged with those values filtered out.
Rails.application.config.filter_parameters += %i[
  passw secret token _key crypt salt certificate otp ssn
  candidate_name assessor_notes transcript evidence competency_summary system_prompt
]
