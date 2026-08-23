# frozen_string_literal: true
module Api
    module V1
        class SkillTaxonomySerializer < BaseSerializer
            LIST_ATTRIBUTES = %i[id skill_id skill_label category].freeze

            DETAIL_ATTRIBUTES = LIST_ATTRIBUTES + %i[
                scope_include
                scope_exclude
                l1_anchor
                l2_anchor
                l3_anchor
                l4_anchor
                l5_anchor
            ].freeze

            def self.list(skill)
                skill.attributes.slice(*LIST_ATTRIBUTES.map(&:to_s))
            end

            def self.detail(skill)
                skill.attributes.slice(*DETAIL_ATTRIBUTES.map(&:to_s))
            end
        end
    end
end
