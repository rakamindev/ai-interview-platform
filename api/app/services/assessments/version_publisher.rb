# frozen_string_literal: true

module Assessments
  class VersionPublisher
    class InvalidRubric < StandardError; end

    def initialize(assessment)
      @assessment = assessment
    end

    def call
      @assessment.assessment_versions.find_by(rubric_version: @assessment.rubric_version) || publish!
    end

    private

    def publish!
      skills = @assessment.assessment_skills.reload.order(:display_order).to_a
      validate_rubric!(skills)

      prompt = SystemPromptCompiler.new(@assessment).call
      version = @assessment.assessment_versions.create!(
        rubric_version: @assessment.rubric_version,
        name:           @assessment.name,
        time_limit_min: @assessment.time_limit_min,
        language:       @assessment.language.presence || 'en',
        system_prompt:  prompt
      )

      version.allow_skill_copies do
        skills.each do |skill|
          version.assessment_version_skills.create!(version_skill_attributes(skill))
        end
      end

      version
    end

    def validate_rubric!(skills)
      errors = []
      errors << 'Assessment must include at least one skill before inviting a candidate' if skills.empty?
      errors << 'Assessment name is required' if @assessment.name.blank?
      errors << 'Assessment time limit is invalid' unless [10, 30, 45, 60, 90].include?(@assessment.time_limit_min)
      errors << 'Assessment language is invalid' unless Assessment::SUPPORTED_LANGUAGES.key?(@assessment.language.presence || 'en')

      skills.each_with_index do |skill, index|
        prefix = "Skill #{index + 1}"
        errors << "#{prefix} label is required" if skill.skill_label.blank?
        errors << "#{prefix} must define all L1-L5 anchors" if anchors_missing?(skill)
        errors << "#{prefix} expected level is invalid" unless skill.expected_level.in?(1..5)
      end

      duplicate_labels = skills.group_by { |skill| skill.skill_label.to_s.strip.downcase }
                               .select { |label, entries| label.present? && entries.size > 1 }
                               .keys
      errors << "Assessment contains duplicate skills: #{duplicate_labels.join(', ')}" if duplicate_labels.any?

      duplicate_skill_ids = skills.filter_map(&:skill_id)
                                  .group_by(&:itself)
                                  .select { |_skill_id, entries| entries.size > 1 }
                                  .keys
      errors << "Assessment contains duplicate skill IDs: #{duplicate_skill_ids.join(', ')}" if duplicate_skill_ids.any?

      duplicate_orders = skills.group_by(&:display_order)
                               .select { |_order, entries| entries.size > 1 }
                               .keys
      errors << 'Assessment skill order must be unique' if duplicate_orders.any?

      raise InvalidRubric, errors.join('. ') if errors.any?
    end

    def anchors_missing?(skill)
      %i[l1_anchor l2_anchor l3_anchor l4_anchor l5_anchor].any? { |anchor| skill.public_send(anchor).blank? }
    end

    def version_skill_attributes(skill)
      {
        skill_id:       skill.skill_id,
        skill_label:    skill.skill_label,
        is_custom:      skill.is_custom,
        scope_include:  skill.scope_include,
        scope_exclude:  skill.scope_exclude,
        l1_anchor:      skill.l1_anchor,
        l2_anchor:      skill.l2_anchor,
        l3_anchor:      skill.l3_anchor,
        l4_anchor:      skill.l4_anchor,
        l5_anchor:      skill.l5_anchor,
        expected_level: skill.expected_level,
        display_order:  skill.display_order
      }
    end
  end
end
