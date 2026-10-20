# frozen_string_literal: true

class Session < ApplicationRecord
  include TenantScoped

  STATUSES   = %w[pending active ended failed].freeze
  END_REASONS = %w[manual_candidate manual_assessor all_covered time_ceiling error].freeze

  belongs_to :assessment
  has_many :transcript_turns, dependent: :destroy
  has_many :coverage_maps, dependent: :destroy
  has_one  :portfolio, dependent: :destroy

  validates :invite_token, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validates :end_reason, inclusion: { in: END_REASONS }, allow_nil: true

  before_validation :generate_invite_token, on: :create

  scope :active,  -> { where(status: 'active') }
  scope :pending, -> { where(status: 'pending') }
  scope :ended,   -> { where(status: 'ended') }

  def active?  = status == 'active'
  def ended?   = status == 'ended'
  def pending? = status == 'pending'

  # What the candidate page may report during a proctored interview, as pairs: the rule broken, then put right. The
  # browser is the candidate's, so anything else is ignored, and the list is capped so a misbehaving page can't grow
  # the row without limit.
  PROCTORING_PAIRS = {
    'camera' => %w[camera_stopped camera_resumed],
    'screen' => %w[screen_stopped screen_resumed],
    'second_screen' => %w[second_screen_connected second_screen_disconnected]
  }.freeze
  PROCTORING_EVENTS = PROCTORING_PAIRS.values.flatten.freeze
  MAX_PROCTORING_EVENTS = 200

  def record_proctoring_event!(event, at: Time.current)
    return false unless PROCTORING_EVENTS.include?(event)
    return false if proctoring_events.size >= MAX_PROCTORING_EVENTS

    update_columns(proctoring_events: proctoring_events + [{ 'event' => event, 'at' => at.iso8601 }])
  end

  # How often and for how long the camera and the screen share were off, and a second screen connected.
  def proctoring_summary
    camera = proctoring_breaks('camera')
    screen = proctoring_breaks('screen')
    second_screen = proctoring_breaks('second_screen')
    {
      'camera' => { stops: camera[0], off_seconds: camera[1] },
      'screen' => { stops: screen[0], off_seconds: screen[1] },
      'second_screen' => { connected: second_screen[0], seconds: second_screen[1] }
    }
  end

  # The candidate opens this in the web app (InterviewPage), so the base is the web app's URL, not the API's.
  def invite_url
    base = ENV.fetch('APP_BASE_URL', 'http://localhost:5173').chomp('/')
    "#{base}/interview/#{invite_token}"
  end

  private

  # [times, seconds] one rule was broken. A repeated break counts once; one never put right runs to the end of the
  # interview (or to now, while it's still going).
  def proctoring_breaks(kind)
    broken, fixed = PROCTORING_PAIRS.fetch(kind)
    times = 0
    seconds = 0.0
    since = nil
    proctoring_events.each do |e|
      at = Time.zone.parse(e['at'])
      if e['event'] == broken && !since
        times += 1
        since = at
      elsif e['event'] == fixed && since
        seconds += at - since
        since = nil
      end
    end
    seconds += (ended_at || Time.current) - since if since
    [times, seconds.round]
  end

  def generate_invite_token
    self.invite_token ||= SecureRandom.hex(32)
  end
end
