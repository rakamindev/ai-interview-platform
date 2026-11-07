# frozen_string_literal: true

module Api
  module V1
    class AssessmentsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_assessment, only: %i[show update destroy]

      # GET /api/v1/assessments
      def index
        assessments = paginate(
          Assessment.includes(:sessions).order(created_at: :desc)
        )

        json_response(
          assessments: assessments.map(&method(:assessment_json)),
          meta: pagination_meta(assessments)
        )
      end

      # GET /api/v1/assessments/:id
      def show
        json_response(assessment: assessment_with_skills_json(@assessment))
      end

      # POST /api/v1/assessments
      def create
        vacancy_id = params[:assessment][:vacancy_id]
        
        if vacancy_id.present?
          vacancy = Vacancy.includes(:vacancy_skills).find_by(id: vacancy_id)
          return json_error("Vacancy not found", :not_found) unless vacancy

          assessment = Assessment.new(
            tenant_id: current_tenant_id,
            created_by: current_user.id,
            name: vacancy.role_title, 
            time_limit_min: params[:assessment][:time_limit_min],
            language: params[:assessment][:language] || "en"
          )

          ActiveRecord::Base.transaction do
            assessment.save!
            assessment.assessment_skills.destroy_all
            vacancy.vacancy_skills.each_with_index do |v_skill, index|
              taxonomy = SkillTaxonomy.find_by(skill_id: v_skill.skill_id) if v_skill.skill_id.present?

              assessment.assessment_skills.create!(
                skill_id:       v_skill.skill_id,
                skill_label:    v_skill.skill_label,
                is_custom:      v_skill.skill_id.blank?,
                expected_level: v_skill.expected_level,
                display_order:  index,
                scope_include:  taxonomy&.scope_include,
                scope_exclude:  taxonomy&.scope_exclude,
                l1_anchor:      taxonomy&.l1_anchor || "Level 1 expectation",
                l2_anchor:      taxonomy&.l2_anchor || "Level 2 expectation",
                l3_anchor:      taxonomy&.l3_anchor || "Level 3 expectation",
                l4_anchor:      taxonomy&.l4_anchor || "Level 4 expectation",
                l5_anchor:      taxonomy&.l5_anchor || "Level 5 expectation"
              )
            end
          end
        else
          assessment = Assessment.new(assessment_params)
          assessment.created_by = current_user.id
          assessment.save!
        end

        SystemPromptGeneratorWorker.perform_async(assessment.id)
        json_response({ assessment:, system_prompt_generated: true }, :created)
      rescue ActiveRecord::RecordInvalid => e
        json_error(e.message, :unprocessable_entity)
      end

      # PUT /api/v1/assessments/:id
      def update
        vacancy_id = params[:assessment][:vacancy_id]

        ActiveRecord::Base.transaction do
          if vacancy_id.present?
            vacancy = Vacancy.includes(:vacancy_skills).find_by(id: vacancy_id)
            return json_error("Vacancy not found", :not_found) unless vacancy

            @assessment.update!(
              name: vacancy.role_title,
              time_limit_min: params[:assessment][:time_limit_min] || @assessment.time_limit_min,
              language: params[:assessment][:language] || @assessment.language
            )

            @assessment.assessment_skills.destroy_all
            vacancy.vacancy_skills.each_with_index do |v_skill, index|
              taxonomy = SkillTaxonomy.find_by(skill_id: v_skill.skill_id) if v_skill.skill_id.present?

              @assessment.assessment_skills.create!(
                skill_id:       v_skill.skill_id,
                skill_label:    v_skill.skill_label,
                is_custom:      v_skill.skill_id.blank?,
                expected_level: v_skill.expected_level,
                display_order:  index,
                scope_include:  taxonomy&.scope_include,
                scope_exclude:  taxonomy&.scope_exclude,
                l1_anchor:      taxonomy&.l1_anchor || "Level 1 expectation",
                l2_anchor:      taxonomy&.l2_anchor || "Level 2 expectation",
                l3_anchor:      taxonomy&.l3_anchor || "Level 3 expectation",
                l4_anchor:      taxonomy&.l4_anchor || "Level 4 expectation",
                l5_anchor:      taxonomy&.l5_anchor || "Level 5 expectation"
              )
            end
          else
            @assessment.update!(assessment_params)
          end
        end

        SystemPromptGeneratorWorker.perform_async(@assessment.id)
        json_response({ assessment: assessment_with_skills_json(@assessment), system_prompt_generated: true })
      rescue ActiveRecord::RecordInvalid => e
        json_error(e.message, :unprocessable_entity)
      end

      # DELETE /api/v1/assessments/:id
      def destroy
        @assessment.destroy
        json_response({ message: "Assessment deleted" })
      end

      private

      def set_assessment
        @assessment = Assessment.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Assessment not found", :not_found)
      end

      def assessment_params
        params.require(:assessment).permit(
          :name,
          :time_limit_min,
          :language,
          assessment_skills_attributes: %i[
            id skill_id skill_label is_custom
            scope_include scope_exclude
            l1_anchor l2_anchor l3_anchor l4_anchor l5_anchor
            expected_level display_order _destroy
          ]
        )
      end

      def assessment_json(assessment)
        latest = assessment.sessions.max_by(&:created_at)

        {
          id:             assessment.id,
          name:           assessment.name,
          time_limit_min: assessment.time_limit_min,
          language:       assessment.language || 'en',
          system_prompt:  assessment.system_prompt,
          created_by:     assessment.created_by,
          created_at:     assessment.created_at,
          updated_at:     assessment.updated_at,
          latest_session: latest && {
            id:         latest.id,
            status:     latest.status,
            end_reason: latest.end_reason
          }
        }
      end

      def assessment_with_skills_json(assessment)
        assessment_json(assessment).merge(
          skills: assessment.assessment_skills.order(:display_order).map do |s|
            {
              id:            s.id,
              skill_id:      s.skill_id,
              skill_label:   s.skill_label,
              is_custom:     s.is_custom,
              scope_include: s.scope_include,
              scope_exclude: s.scope_exclude,
              l1_anchor:     s.l1_anchor,
              l2_anchor:     s.l2_anchor,
              l3_anchor:     s.l3_anchor,
              l4_anchor:     s.l4_anchor,
              l5_anchor:     s.l5_anchor,
              expected_level: s.expected_level,
              display_order: s.display_order
            }
          end
        )
      end

      def pagination_meta(collection)
        {
          current_page: collection.current_page,
          total_pages:  collection.total_pages,
          total_count:  collection.total_count,
          per_page:     collection.limit_value
        }
      end
    end
  end
end