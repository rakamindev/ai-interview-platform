# frozen_string_literal: true

class AssessmentSkill < ApplicationRecord
  ANCHOR_FIELDS = %i[l1_anchor l2_anchor l3_anchor l4_anchor l5_anchor].freeze
  SKILL_ID_MAX_LENGTH = 50

  belongs_to :assessment, inverse_of: :assessment_skills

  validates :skill_label, presence: true
  validates :display_order, presence: true
  validates :expected_level, numericality: { only_integer: true,
                                             in: 1..5,
                                             allow_nil: true }

  validate :taxonomy_identity_is_present
  validate :scope_is_present
  validate :anchors_are_complete

  private

  # A skill picked from the taxonomy carries the identity that portfolio and
  # fit/gap matching rely on; a custom skill has no taxonomy id by definition.
  # Every message is reported verbatim on the base so the client can mirror it
  # without Rails prefixing it with the humanised attribute name.
  def taxonomy_identity_is_present
    return if is_custom
    return if persisted? && skill_id.blank? && attribute_in_database(:skill_id).blank?

    errors.add(:base, 'Skill id is required') if skill_id.blank?
    return if skill_id.to_s.length <= SKILL_ID_MAX_LENGTH

    errors.add(:base, 'Skill id is too long (maximum is 50 characters)')
  end

  def scope_is_present
    return if persisted? && scope_include.blank? && attribute_in_database(:scope_include).blank?
    return if scope_include.present?

    errors.add(:base, 'Skill scope is required')
  end

  def anchors_are_complete
    missing = ANCHOR_FIELDS.select { |field| self[field].blank? }
    return if missing.empty?
    return if persisted? && missing.all? { |field| attribute_in_database(field).blank? }

    errors.add(:base, 'Skill anchors L1-L5 are required')
  end
end
