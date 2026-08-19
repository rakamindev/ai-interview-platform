# frozen_string_literal: true

class Portfolio < ApplicationRecord
  GENERATION_STATUSES = %w[pending generating complete failed].freeze
  VERDICTS = %w[pass consider failed].freeze

  belongs_to :session
  has_many :portfolio_skills, dependent: :destroy
  has_many :assessor_overrides, through: :portfolio_skills

  validates :generation_status, inclusion: { in: GENERATION_STATUSES }
  validates :verdict, inclusion: { in: VERDICTS }, allow_nil: true

  scope :complete,    -> { where(generation_status: 'complete') }
  scope :failed,      -> { where(generation_status: 'failed') }
  scope :generating,  -> { where(generation_status: 'generating') }

  def complete?    = generation_status == 'complete'
  def generating?  = generation_status == 'generating'
  def failed?      = generation_status == 'failed'

  # Recomputes and persists the candidate verdict (pass/consider/failed) and
  # its plain-English summary sentence from current skill levels (AI rating,
  # or the assessor override when one exists). Called whenever skill data
  # changes: after generation and after any override.
  def recompute_verdict!
    rows = verdict_rows

    levels = rows.map { |row| row[:level] }
    new_verdict =
      if levels.empty?
        nil
      else
        average = levels.sum.to_f / levels.size
        if average >= 4.0
          'pass'
        elsif average >= 2.5
          'consider'
        else
          'failed'
        end
      end

    new_summary = verdict_summary_sentence(rows)

    if new_verdict != verdict || new_summary != verdict_summary
      update_columns(verdict: new_verdict, verdict_summary: new_summary)
    end
  end

  private

  def verdict_rows
    portfolio_skills.filter_map do |skill|
      override = skill.assessor_override
      level = override ? override.override_level : skill.ai_level
      next if level.blank? || level <= 0

      {
        label: skill.skill_label,
        level: level,
        low_confidence: override.blank? && skill.ai_confidence.to_s.downcase == 'low'
      }
    end
  end

  def verdict_summary_sentence(rows)
    return nil if rows.empty?

    strengths = rows.select { |r| r[:level] >= 4 }.sort_by { |r| -r[:level] }
    concerns  = rows.select { |r| r[:level] <= 2 || r[:low_confidence] }.sort_by { |r| r[:level] }

    strength_names = join_names(strengths.first(2).map { |r| r[:label] })
    concern_names  = join_names(concerns.first(2).map { |r| r[:label] })

    if strengths.any? && concerns.any?
      return "Strong on #{strength_names}. Less certain on #{concern_names} — worth a follow-up before deciding."
    end

    return "Strong across the board, especially #{strength_names}." if strengths.any?

    if concerns.any?
      return rows.size == 1 ? "Only tested on #{rows.first[:label]}, and the result was weak or uncertain — treat this as a narrow, inconclusive read." : "Weak or uncertain results on #{concern_names} — worth a follow-up before deciding."
    end

    'Solid, consistent performance across everything assessed.'
  end

  def join_names(names)
    case names.size
    when 1 then names[0]
    when 2 then "#{names[0]} and #{names[1]}"
    else "#{names[0...-1].join(', ')}, and #{names[-1]}"
    end
  end
end
