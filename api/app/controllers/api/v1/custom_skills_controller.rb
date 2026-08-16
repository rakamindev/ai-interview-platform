# frozen_string_literal: true

module Api
  module V1
    class CustomSkillsController < ApiController
      authorize_auth_token! :assessor

      # GET /api/v1/custom_skills
      def index
        skills = CustomSkill.order(:skill_label)

        json_response(custom_skills: skills.map(&method(:skill_json)))
      end

      # POST /api/v1/custom_skills
      def create
        skill = CustomSkill.new(skill_params)
        skill.created_by = current_user.id

        if skill.save
          json_response({ custom_skill: skill_json(skill), message: 'Custom skill added' }, :created)
        else
          json_error(skill.errors.full_messages.first, :unprocessable_entity)
        end
      end

      # DELETE /api/v1/custom_skills/:id
      def destroy
        skill = CustomSkill.find(params[:id])
        skill.destroy

        json_response(message: 'Custom skill removed')
      rescue ActiveRecord::RecordNotFound
        json_error('Custom skill not found', :not_found)
      end

      private

      def skill_params
        params.require(:custom_skill).permit(
          :skill_label, :scope_include, :scope_exclude,
          :l1_anchor, :l2_anchor, :l3_anchor, :l4_anchor, :l5_anchor
        )
      end

      def skill_json(skill)
        {
          id:            skill.id,
          skill_label:   skill.skill_label,
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
