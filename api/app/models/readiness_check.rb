# frozen_string_literal: true

# Validates and sanitises a candidate's pre-interview readiness result before it
# is stored on Session#readiness_check.
#
# Data minimisation (UU PDP): only whitelisted fields are kept. No IP address and
# no raw user-agent string; client info is a short browser/OS label.
# Unmeasured metrics stay nil: we never invent numbers for a measurement that failed.
class ReadinessCheck
  include ActiveModel::Validations

  VERDICTS          = %w[pass warn fail].freeze
  CHECK_NAMES       = %w[browser network microphone audio_output].freeze
  CHECK_STATES      = %w[passed warn failed unknown skipped].freeze
  MAX_MBPS          = 10_000
  MAX_LATENCY_MS    = 60_000
  MAX_CLIENT_STRING = 50

  attr_reader :verdict, :download_mbps, :upload_mbps, :latency_ms, :checks, :browser, :os

  validates :verdict, inclusion: { in: VERDICTS }
  validates :download_mbps, :upload_mbps,
            numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: MAX_MBPS },
            allow_nil: true
  validates :latency_ms,
            numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: MAX_LATENCY_MS },
            allow_nil: true
  validate :checks_use_known_states

  def initialize(verdict: nil, network: {}, checks: {}, client: {})
    network = (network || {}).to_h.with_indifferent_access
    client  = (client || {}).to_h.with_indifferent_access

    @verdict       = verdict.to_s
    @download_mbps = network[:download_mbps]
    @upload_mbps   = network[:upload_mbps]
    @latency_ms    = network[:latency_ms]
    @checks        = (checks || {}).to_h.stringify_keys.slice(*CHECK_NAMES).transform_values(&:to_s)
    @browser       = short_label(client[:browser])
    @os            = short_label(client[:os])
  end

  # Hash persisted to the jsonb column. Call only after #valid?.
  def to_record(previous_attempts: 0, now: Time.current)
    {
      'verdict'       => verdict,
      'download_mbps' => rounded(download_mbps, 2),
      'upload_mbps'   => rounded(upload_mbps, 2),
      'latency_ms'    => latency_ms.nil? ? nil : Float(latency_ms).round,
      'checks'        => checks,
      'browser'       => browser,
      'os'            => os,
      'attempts'      => previous_attempts + 1,
      'checked_at'    => now.iso8601
    }
  end

  def error_details
    errors.map { |e| "#{e.attribute} #{e.message}" }
  end

  private

  def checks_use_known_states
    unknown = checks.reject { |_name, state| CHECK_STATES.include?(state) }
    return if unknown.empty?

    errors.add(:checks, "contain unknown states: #{unknown.keys.join(', ')}")
  end

  def rounded(value, digits)
    value.nil? ? nil : Float(value).round(digits)
  end

  def short_label(value)
    value.to_s.gsub(/[^[:print:]]/, '').strip.first(MAX_CLIENT_STRING).presence
  end
end
