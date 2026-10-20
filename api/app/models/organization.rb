# frozen_string_literal: true

# Read-only reference to the existing rakamin-api organizations table.
# Lives in the PostgreSQL public schema (excluded from Apartment in rakamin-api).
# We connect to the same DB so this table is directly accessible.
#
# Only includes the fields we need for tenant resolution.
class Organization < ApplicationRecord
  self.table_name = 'organizations'

  ALLOWED_GEMINI_VOICES = %w[Puck Charon Aoede Fenrir Kore].freeze
  DEFAULT_GEMINI_VOICE = 'Puck'
  DEFAULT_TEMPERATURE = 0.2

  has_many :assessments, foreign_key: :tenant_id, dependent: :destroy
  has_many :vacancies, foreign_key: :tenant_id, dependent: :destroy
  has_many :sessions, foreign_key: :tenant_id, dependent: :destroy
  has_many :portfolios, through: :sessions

  validate :validate_ai_config

  # Mirrors rakamin-api Organisation.identify exactly.
  # Accepts identifier, name, scheme, or host.
  def self.identify(identifier)
    return default_organization if identifier.blank?

    sql_string = <<~SQL.squish
      (? IN (identifier, name, scheme, host)) OR
      (alias_hosts && ARRAY[?]::varchar[])
    SQL

    where(sql_string, identifier, Array(identifier)).first ||
      default_organization
  end

  def self.default_organization
    where(id: 0).first
  end

  def default?
    id.zero?
  end

  def ai_config
    (config || {})['ai'] || {}
  end

  def custom_ai_configured?
    ai_config['gemini_api_key'].present?
  end

  # Resolves organization-specific Gemini API key or falls back to system ENV.
  def gemini_api_key
    ai_config['gemini_api_key'].presence || ENV['GEMINI_API_KEY']
  end

  # Resolves model tier (live, flash, pro) from tenant config with fallback to ENV defaults.
  def gemini_model(tier = :live)
    custom_model = ai_config.dig('models', tier.to_s).presence ||
                   ai_config.dig('models', tier.to_sym).presence
    return custom_model if custom_model.present?

    case tier.to_sym
    when :live
      ENV['GEMINI_LIVE_MODEL'].presence || 'gemini-2.0-flash-exp'
    when :flash
      ENV['GEMINI_FLASH_MODEL'].presence || 'gemini-2.0-flash'
    when :pro
      ENV['GEMINI_PRO_MODEL'].presence || 'gemini-2.0-pro-exp-02-05'
    else
      ENV['GEMINI_FLASH_MODEL'].presence || 'gemini-2.0-flash'
    end
  end

  def gemini_voice
    ai_config['voice'].presence || DEFAULT_GEMINI_VOICE
  end

  def gemini_temperature
    raw_temp = ai_config['temperature']
    raw_temp.present? ? raw_temp.to_f : DEFAULT_TEMPERATURE
  end

  # Masks the secret key for safe presentation over management APIs.
  def masked_gemini_api_key
    key = ai_config['gemini_api_key']
    return nil if key.blank?
    return '****' if key.length <= 8

    "#{key[0..5]}...#{key[-4..-1]}"
  end

  def update_ai_config!(gemini_api_key: nil, models: nil, voice: nil, temperature: nil)
    current_ai = ai_config.dup
    current_ai['gemini_api_key'] = gemini_api_key if gemini_api_key.present?
    current_ai['models'] = models.stringify_keys if models.is_a?(Hash)
    current_ai['voice'] = voice if voice.present?
    current_ai['temperature'] = temperature.to_f if temperature.present?

    new_config = (config || {}).dup
    new_config['ai'] = current_ai
    self.config = new_config
    save!
  end

  private

  def validate_ai_config
    return if config.blank?

    unless config.is_a?(Hash)
      errors.add(:config, 'must be a valid json object')
      return
    end

    ai = config['ai']
    return if ai.nil?

    unless ai.is_a?(Hash)
      errors.add(:config, 'ai configuration must be an object')
      return
    end

    if ai['voice'].present? && !ALLOWED_GEMINI_VOICES.include?(ai['voice'])
      errors.add(:config, "voice must be one of: #{ALLOWED_GEMINI_VOICES.join(', ')}")
    end

    if ai['temperature'].present?
      temp = ai['temperature']
      unless temp.is_a?(Numeric) && temp >= 0.0 && temp <= 1.0
        errors.add(:config, 'temperature must be a numeric value between 0.0 and 1.0')
      end
    end

    if ai['models'].present? && !ai['models'].is_a?(Hash)
      errors.add(:config, 'models must be a key-value mapping of tier to model name')
    end
  end
end
