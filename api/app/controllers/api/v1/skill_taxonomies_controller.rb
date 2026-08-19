# frozen_string_literal: true

module Api
  module V1
    class SkillTaxonomiesController < ApiController
      authorize_auth_token! :assessor

      # GET /api/v1/skill_taxonomies
      def index
        skills = SkillTaxonomy.order(:skill_id)
        skills = skills.where(category: params[:category]) if params[:category].present?

        json_response(skill_taxonomies: skills.map(&method(:skill_json)))
      end

      # GET /api/v1/skill_taxonomies/:skill_id
      def show
        skill = SkillTaxonomy.find_by!(skill_id: params[:skill_id])
        json_response(skill: skill_json(skill))
      rescue ActiveRecord::RecordNotFound
        json_error("Skill not found", :not_found)
      end

      # POST /api/v1/skill_taxonomies/suggest
      def suggest
        label = params[:skill_label].to_s.strip
        return json_error("skill_label is required", :unprocessable_entity) if label.blank?

        result = SkillTaxonomies::SuggestMatch.new(skill_label: label).call

        if result
          json_response(
            suggestion: skill_json(result[:skill]).merge(
              confidence: result[:confidence],
              reasoning:  result[:reasoning]
            )
          )
        else
          json_response(suggestion: nil)
        end
      end

      private

      def skill_json(skill)
        {
          skill_id:      skill.skill_id,
          skill_label:   skill.skill_label,
          category:      skill.category,
          scope_include: skill.scope_include,
          scope_exclude: skill.scope_exclude,
          l1_anchor:     skill.l1_anchor,
          l2_anchor:     skill.l2_anchor,
          l3_anchor:     skill.l3_anchor,
          l4_anchor:     skill.l4_anchor,
          l5_anchor:     skill.l5_anchor
        }
      end
    end
  end
end
