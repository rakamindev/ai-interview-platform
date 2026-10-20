# frozen_string_literal: true

require 'digest'

class FitGapReport < ApplicationRecord
  FIT_RESULTS = %w[match gap exceed not_assessed].freeze

  belongs_to :portfolio
  belongs_to :vacancy

  validates :skill_comparisons, presence: true

  # AC-D6: Hash of portfolio generated_at, overrides (id, updated_at, level), vacancy updated_at, and vacancy skills
  def self.calculate_source_fingerprint(portfolio:, vacancy:)
    return nil unless portfolio && vacancy

    portfolio_time = portfolio.generated_at&.to_i || portfolio.updated_at&.to_i
    overrides_data = portfolio.assessor_overrides.order(:id).map do |o|
      time_val = (o.respond_to?(:overridden_at) && o.overridden_at) || (o.respond_to?(:updated_at) && o.updated_at)
      "#{o.id}:#{time_val&.to_i}:#{o.override_level}"
    end.join(';')

    vacancy_time = vacancy.updated_at&.to_i
    vacancy_skills = vacancy.vacancy_skills.order(:id).map do |vs|
      "#{vs.skill_label.to_s.strip.downcase}:#{vs.expected_level}"
    end.join(';')

    raw_payload = [portfolio_time, overrides_data, vacancy_time, vacancy_skills].join('|')
    Digest::SHA256.hexdigest(raw_payload)
  end

  # AC-F6: Checks if the report is stale compared to current portfolio, overrides, or vacancy
  def stale?
    return true if source_fingerprint.blank?

    p = portfolio&.persisted? ? portfolio.reload : portfolio
    v = vacancy&.persisted? ? vacancy.reload : vacancy
    current_fp = self.class.calculate_source_fingerprint(portfolio: p, vacancy: v)
    source_fingerprint != current_fp
  end
end
