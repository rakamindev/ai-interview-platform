# frozen_string_literal: true

# Proof that a candidate agreed to be assessed, as UU PDP Pasal 24 requires
# the controller to be able to show.
#
# One row per session, enforced by a unique index rather than a validation
# alone — a validation can be raced, a unique index cannot. Two concurrent
# POSTs therefore produce one record instead of two.
class Consent < ApplicationRecord
  belongs_to :session

  validates :version, presence: true
  validates :consented_at, presence: true
  validates :session_id, uniqueness: true

  # True when the record covers the wording currently in ConsentText.
  #
  # A consent given against older wording is still a real consent, but it is
  # consent to something else, so the candidate has to be asked again before
  # the interview starts.
  def current?
    version == ConsentText::VERSION
  end
end
