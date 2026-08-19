# frozen_string_literal: true

module Api
  module V1
    class AssessmentsController < ApiController
      authorize_auth_token! :portal
      before_action :require_assessor!, only: %i[create update destroy duplicate]
      before_action :set_assessment, only: %i[show update destroy duplicate]

      # GET /api/v1/assessments
      def index
        scope = Assessment.includes(:sessions).where(tenant_id: current_tenant_id).order(created_at: :desc)

        if params[:search].present?
          query = "%#{params[:search].to_s.downcase}%"
          scope = scope.where('LOWER(name) LIKE ?', query)
        end

        assessments = paginate(scope)

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
        assessment = Assessment.new(assessment_params)
        assessment.created_by = current_user.id
        assessment.tenant_id  = current_tenant_id

        if assessment.save
          SystemPromptGeneratorWorker.perform_async(assessment.id) if defined?(SystemPromptGeneratorWorker)
          json_response({ assessment: assessment_with_skills_json(assessment), system_prompt_generated: true }, :created)
        else
          json_error(assessment.errors.full_messages.first, :unprocessable_entity)
        end
      end

      # POST /api/v1/assessments/:id/duplicate
      def duplicate
        new_assessment = @assessment.dup
        new_assessment.name = "#{@assessment.name} (Copy)"
        new_assessment.created_by = current_user.id
        new_assessment.created_at = nil
        new_assessment.updated_at = nil

        if new_assessment.save
          @assessment.assessment_skills.each do |skill|
            new_skill = skill.dup
            new_skill.assessment_id = new_assessment.id
            new_skill.save!
          end

          SystemPromptGeneratorWorker.perform_async(new_assessment.id) if defined?(SystemPromptGeneratorWorker)
          json_response({ assessment: assessment_with_skills_json(new_assessment) }, :created)
        else
          json_error(new_assessment.errors.full_messages.first, :unprocessable_entity)
        end
      end

      # PUT /api/v1/assessments/:id
      def update
        if @assessment.update(assessment_params)
          SystemPromptGeneratorWorker.perform_async(@assessment.id) if defined?(SystemPromptGeneratorWorker)
          json_response({ assessment: assessment_with_skills_json(@assessment), system_prompt_generated: true })
        else
          json_error(@assessment.errors.full_messages.first, :unprocessable_entity)
        end
      end

      # DELETE /api/v1/assessments/:id
      def destroy
        @assessment.destroy
        json_response({ message: "Assessment deleted" })
      end

      private

      def require_assessor!
        return if current_user && %w[admin assessor].include?(current_user.role)

        raise ExceptionHandler::Unauthorized, "Assessor or Admin permissions required"
      end

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
