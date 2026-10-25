# frozen_string_literal: true

module RetentionPolicy
  module_function

  # Fit/Gap reports are audit data, so a vacancy with reports is archived
  # instead of being physically deleted.
  def vacancy_action(has_fit_gap_reports:)
    has_fit_gap_reports ? :archive : :delete
  end

  # Candidate evidence is retained once an interview has started. Only an
  # unused pending invite may be withdrawn.
  def session_deletable?(status)
    status.to_s == 'pending'
  end
end
