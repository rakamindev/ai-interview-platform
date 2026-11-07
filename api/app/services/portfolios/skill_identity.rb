# frozen_string_literal: true

module Portfolios
  # Comparison only: persisted keys and configured assessment identities are unchanged.
  # A discovered key can collide after punctuation/non-ASCII normalization, so its label must match too.
  module SkillIdentity
    def self.key(skill)
      return [skill.skill_key] unless skill.is_discovered

      [skill.skill_key, skill.skill_label.to_s.strip.downcase.squeeze(' ')]
    end
  end
end
