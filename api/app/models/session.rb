# frozen_string_literal: true

class Session < ApplicationRecord
  include TenantScoped

  STATUSES   = %w[pending active ended failed].freeze
  END_REASONS = %w[manual_candidate manual_assessor all_covered time_ceiling error].freeze

  belongs_to :assessment
  has_many :transcript_turns, dependent: :destroy
  has_many :coverage_maps, dependent: :destroy
  has_one  :portfolio, dependent: :destroy
  has_one  :consent, dependent: :destroy

  validates :invite_token, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validates :end_reason, inclusion: { in: END_REASONS }, allow_nil: true

  # Which class of failure broke the session. Coarser than end_reason: the
  # session still ends with end_reason 'error', but this records WHAT KIND of
  # error it was, so an assessor knows what to do next instead of guessing.
  #
  #   user       - the candidate's side (mic denied, device gone, browser
  #                dropped and never came back). Retrying this candidate may
  #                well work, and it is not our bug.
  #   transient  - the interview provider was unavailable after every retry
  #                was exhausted. Retry later; nothing is wrong with the
  #                candidate, so do not hold it against them.
  #   config     - a model or API key is missing or invalid. This class
  #                should be caught BEFORE a candidate is ever let into a
  #                session, never halfway through an answer.
  #   permanent  - an unexpected exception. Escalate to engineering; simply
  #                retrying will hit the same bug.
  #
  # nil means nothing went wrong, which is the normal case and must stay the
  # default rather than being encoded as an empty string.
  FAILURE_CLASSES = %w[user transient config permanent].freeze
  validates :failure_class, inclusion: { in: FAILURE_CLASSES }, allow_nil: true

  before_validation :generate_invite_token, on: :create

  scope :active,  -> { where(status: 'active') }
  scope :pending, -> { where(status: 'pending') }
  scope :ended,   -> { where(status: 'ended') }

  def active?  = status == 'active'
  def ended?   = status == 'ended'
  def pending? = status == 'pending'

  def invite_url
    base = ENV.fetch('APP_BASE_URL', 'http://localhost:3001')
    "#{base}/interview/#{invite_token}"
  end

  private

  def generate_invite_token
    self.invite_token ||= SecureRandom.hex(32)
  end
end
