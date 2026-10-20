# frozen_string_literal: true

module Api
  module V1
    class AssessmentsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_assessment, only: %i[show update destroy]

      # GET /api/v1/assessments
      def index
        assessments = paginate(filtered_assessments)

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

        if assessment.save
          SystemPromptGeneratorWorker.perform_async(assessment.id)
          json_response({ assessment:, system_prompt_generated: true }, :created)
        else
          json_error(validation_message(assessment), :unprocessable_entity)
        end
      end

      # PUT /api/v1/assessments/:id
      def update
        if @assessment.update(assessment_params)
          SystemPromptGeneratorWorker.perform_async(@assessment.id)
          json_response({ assessment: assessment_with_skills_json(@assessment), system_prompt_generated: true })
        else
          json_error(validation_message(@assessment), :unprocessable_entity)
        end
      end

      # DELETE /api/v1/assessments/:id
      def destroy
        @assessment.destroy
        json_response({ message: "Assessment deleted" })
      end

      private

      def filtered_assessments
        scope = Assessment.includes(:sessions).order(created_at: :desc)
        search = query_params[:search].to_s.strip
        status = query_params[:status].to_s

        if search.present?
          escaped = ActiveRecord::Base.sanitize_sql_like(search)
          scope = scope.where("assessments.name ILIKE ?", "%#{escaped}%")
        end

        case status
        when "live"
          scope.joins(:sessions).where(sessions: { status: "active" }).distinct
        when "completed"
          scope.joins(:sessions).where(sessions: { status: "ended" }).where.not(sessions: { end_reason: "error" }).distinct
        when "awaiting"
          scope.joins(:sessions).where(sessions: { status: "pending" }).distinct
        else
          scope
        end
      end

      def set_assessment
        @assessment = Assessment.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Assessment not found", :not_found)
      end

      # A nested skill's rule is reported on its own: wrapped in the parent's
      # association prefix the client could not mirror the message.
      def validation_message(assessment)
        invalid_skill = assessment.assessment_skills.find { |skill| skill.errors.any? }
        return invalid_skill.errors.full_messages.first if invalid_skill

        assessment.errors.full_messages.first
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
            id:                latest.id,
            status:             latest.status,
            end_reason:         latest.end_reason,
            consent_accepted:   latest.consent_accepted?,
            consent_declined:   latest.consent_declined?
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
