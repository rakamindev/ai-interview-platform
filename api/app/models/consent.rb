# frozen_string_literal: true

class Consent < ApplicationRecord
  CURRENT_POLICY_VERSION = "2026-08-18"

  belongs_to :session

  validates :policy_version, presence: true
end
