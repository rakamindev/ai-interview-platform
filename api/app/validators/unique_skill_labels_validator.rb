# frozen_string_literal: true

class UniqueSkillLabelsValidator < ActiveModel::Validator
  def validate(record)
    duplicate = labels(record).group_by(&:downcase).values.find { |group| group.size > 1 }
    return unless duplicate

    record.errors.add(:base, :duplicate_skill_labels, message: "Skill '#{duplicate.first}' is listed more than once")
  end

  private

  def labels(record)
    record.public_send(options.fetch(:association))
          .reject(&:marked_for_destruction?)
          .map { |skill| skill.skill_label.to_s.squish }
          .reject(&:blank?)
  end
end
