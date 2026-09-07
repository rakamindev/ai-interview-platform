# frozen_string_literal: true

# The record that a candidate was told what this interview does before it did it.
#
# Not TenantScoped: a candidate has no account and no tenant context. They arrive
# holding an invite token and nothing else, which is the whole point. Reaching a
# consent always goes through its session, and Session is tenant-scoped.
class CandidateConsent < ApplicationRecord
  # Bump when the disclosure text changes. Existing rows keep the version the
  # candidate actually read, so a consent can always be traced to the words that
  # earned it rather than to whatever the page says today.
  CURRENT_VERSION = 'v1'

  belongs_to :session

  validates :session_id, uniqueness: true
  validates :disclosure_version, presence: true
  validates :granted_at, presence: true

  # What the candidate is shown, and what the record attests they were shown.
  # Kept beside the version it belongs to rather than in a template, so the two
  # cannot drift apart.
  DISCLOSURE = {
    version: CURRENT_VERSION,
    recorded: 'Your voice is recorded and transcribed for the length of the interview.',
    assessed_by_ai: 'An AI conducts the interview and produces a draft skill rating from what you say.',
    human_review: 'A human assessor reviews that rating and can change it. You may ask them to.',
    third_party: 'Your speech is processed by Google Gemini to run the interview and the assessment.',
    stored: 'The recording transcript and the rating are kept by the organisation that invited you.',
    rights: 'You may ask that organisation for a copy of your data, or ask them to delete it.'
  }.freeze
end
