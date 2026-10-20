# frozen_string_literal: true

module Api
  module V1
    class SkillTaxonomiesController < ApiController
      authorize_auth_token! :assessor

      # GET /api/v1/skill_taxonomies
      def index
        skills = SkillTaxonomy.order(:skill_label)
        skills = skills.where(category: params[:category]) if params[:category].present?

        json_response(skill_taxonomies: skills.map(&method(:skill_json)))
      end

      # GET /api/v1/skill_taxonomies/:skill_id
      def show
        skill = find_skill
        json_response(skill: skill_json(skill))
      rescue ActiveRecord::RecordNotFound
        json_error("Skill not found", :not_found)
      end

      # POST /api/v1/skill_taxonomies
      def create
        skill = SkillTaxonomy.new(skill_params)
        populate_defaults(skill)

        if skill.save
          json_response({ skill: skill_json(skill) }, :created)
        else
          json_error(skill.errors.full_messages.first, :unprocessable_entity)
        end
      end

      # POST /api/v1/skill_taxonomies/bulk
      def bulk_create
        raw_skills = params[:skills] || []
        if raw_skills.blank?
          return json_error("No skills provided for bulk creation", :unprocessable_entity)
        end

        created_skills = []
        SkillTaxonomy.transaction do
          raw_skills.each do |item|
            p = item.respond_to?(:permit) ? item.permit(:skill_id, :skill_label, :category, :scope_include, :scope_exclude, :l1_anchor, :l2_anchor, :l3_anchor, :l4_anchor, :l5_anchor) : item
            skill = SkillTaxonomy.new(p)
            populate_defaults(skill)
            skill.save!
            created_skills << skill
          end
        end

        json_response({ skills: created_skills.map(&method(:skill_json)), count: created_skills.size }, :created)
      rescue ActiveRecord::RecordInvalid => e
        json_error(e.record.errors.full_messages.first, :unprocessable_entity)
      rescue StandardError => e
        json_error(e.message, :unprocessable_entity)
      end

      # PATCH/PUT /api/v1/skill_taxonomies/:skill_id
      def update
        skill = find_skill
        if skill.update(skill_params)
          json_response(skill: skill_json(skill))
        else
          json_error(skill.errors.full_messages.first, :unprocessable_entity)
        end
      rescue ActiveRecord::RecordNotFound
        json_error("Skill not found", :not_found)
      end

      # DELETE /api/v1/skill_taxonomies/:skill_id
      def destroy
        skill = find_skill
        skill.destroy!
        json_response(message: "Skill deleted successfully")
      rescue ActiveRecord::RecordNotFound
        json_error("Skill not found", :not_found)
      end

      private

      def find_skill
        SkillTaxonomy.find_by(skill_id: params[:skill_id]) || SkillTaxonomy.find_by(id: params[:skill_id]) || raise(ActiveRecord::RecordNotFound)
      end

      def skill_params
        params.require(:skill).permit(
          :skill_id,
          :skill_label,
          :category,
          :scope_include,
          :scope_exclude,
          :l1_anchor,
          :l2_anchor,
          :l3_anchor,
          :l4_anchor,
          :l5_anchor
        )
      end

      def populate_defaults(skill)
        skill.category = 'engineering' if skill.category.blank?
        if skill.skill_id.blank? && skill.skill_label.present?
          base_id = skill.skill_label.parameterize.underscore.slice(0, 40)
          skill.skill_id = base_id.presence || "skill_#{SecureRandom.hex(4)}"
        end

        skill.l1_anchor = "Fundamental conceptual understanding of #{skill.skill_label}." if skill.l1_anchor.blank?
        skill.l2_anchor = "Hands-on implementation of standard #{skill.skill_label} patterns." if skill.l2_anchor.blank?
        skill.l3_anchor = "Autonomous production problem-solving and optimization in #{skill.skill_label}." if skill.l3_anchor.blank?
        skill.l4_anchor = "Advanced architectural design and cross-team leadership in #{skill.skill_label}." if skill.l4_anchor.blank?
        skill.l5_anchor = "Industry mastery and foundational strategy in #{skill.skill_label}." if skill.l5_anchor.blank?
      end

      def skill_json(skill)
        {
          id:            skill.id,
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
