# frozen_string_literal: true

class Session < ApplicationRecord
  include TenantScoped

  STATUSES    = %w[pending active ended failed].freeze unless const_defined?(:STATUSES)
  END_REASONS = %w[manual_candidate manual_assessor all_covered time_ceiling error].freeze unless const_defined?(:END_REASONS)

  belongs_to :assessment
  has_many :transcript_turns, dependent: :destroy
  has_many :coverage_maps, dependent: :destroy
  has_one  :portfolio, dependent: :destroy
  has_one_attached :cv

  validates :invite_token, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validates :end_reason, inclusion: { in: END_REASONS }, allow_nil: true
  validates :candidate_email, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_nil: true

  before_validation :generate_invite_token, on: :create
  before_validation :normalize_candidate_email

  scope :active,  -> { where(status: 'active') }
  scope :pending, -> { where(status: 'pending') }
  scope :ended,   -> { where(status: 'ended') }

  # Sessions that belong to a candidate account. A session is theirs when it was
  # assigned to their email (candidate_email), claimed by their user id, or — for
  # rows created before candidate_email existed — when the assessor typed their
  # email into the free-text candidate_name field.
  scope :for_candidate, lambda { |user|
    email = user.email.to_s.downcase
    where(
      'sessions.candidate_id = :uid OR sessions.candidate_email = :email ' \
      'OR lower(sessions.candidate_name) = :email',
      uid: user.id, email: email
    )
  }

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

  def normalize_candidate_email
    self.candidate_email = candidate_email.to_s.strip.downcase.presence
  end
end
