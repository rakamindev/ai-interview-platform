# frozen_string_literal: true

class Session < ApplicationRecord
    include TenantScoped

    STATUSES = %w[pending active ended failed].freeze
    END_REASONS = %w[
      manual_candidate
      manual_assessor
      all_covered
      time_ceiling
      error
    ].freeze

    STATUS_PENDING = 'pending'
    STATUS_ACTIVE = 'active'
    STATUS_ENDED = 'ended'
    STATUS_FAILED = 'failed'

    END_REASON_MANUAL_CANDIDATE = 'manual_candidate'
    END_REASON_MANUAL_ASSESSOR = 'manual_assessor'
    END_REASON_ALL_COVERED = 'all_covered'
    END_REASON_TIME_CEILING = 'time_ceiling'
    END_REASON_ERROR = 'error'

    belongs_to :assessment
    has_many :transcript_turns, dependent: :destroy
    has_many :coverage_maps, dependent: :destroy
    has_one :portfolio, dependent: :destroy

    validates :invite_token, presence: true, uniqueness: true
    validates :status, inclusion: { in: STATUSES }
    validates :end_reason, inclusion: { in: END_REASONS }, allow_nil: true
    validates :candidate_name, presence: true, format: {
        with: %r{\A[\p{L}\p{N}\s&/\-\.\+#'()]+\z},
        message: 'contains invalid characters'
    }

    before_validation :generate_invite_token, on: :create

    scope :active, -> { where(status: 'active') }
    scope :pending, -> { where(status: 'pending') }
    scope :ended, -> { where(status: 'ended') }

    def active? = status == 'active'

    def ended? = status == 'ended'

    def pending? = status == 'pending'

    def invite_url
        base = ENV.fetch('FE_URL', 'http://localhost:5173')
        "#{base}/interview/#{invite_token}"
    end

    private

    def generate_invite_token
        self.invite_token ||= SecureRandom.hex(32)
    end
end
