# frozen_string_literal: true

class AssessorOverride < ApplicationRecord
  belongs_to :portfolio_skill

  validates :ai_level,       numericality: { only_integer: true, in: 1..5 }, if: -> { portfolio_skill&.rated? }
  validates :override_level, numericality: { only_integer: true, in: 1..5 }
  validates :overridden_by,  presence: true
  # A human changing a candidate's rating has to say why, so the change can be
  # explained to the candidate and audited later.
  validates :assessor_notes, presence: true, length: { maximum: 2000 }
  validate  :skill_must_be_rated

  private

  def skill_must_be_rated
    return if portfolio_skill.nil? || portfolio_skill.rated?

    errors.add(:base, 'This skill was not rated in the interview, so there is no AI level to override. ' \
                      'Schedule a follow-up interview to assess it.')
  end
end
