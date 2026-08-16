# frozen_string_literal: true

module Api
  module V1
    class AssessmentsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_assessment, only: %i[show update destroy]

      # GET /api/v1/assessments
      def index
        scope = Assessment.includes(:sessions)
        scope = scope.where('assessments.name ILIKE ?', "%#{sanitize_like(query_params[:q])}%") if query_params[:q].present?
        scope = scope.where(language: query_params[:language]) if query_params[:language].present?
        scope = filter_by_latest_session_status(scope, query_params[:status]) if query_params[:status].present?
        scope = scope.order(sort_clause)

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

        if assessment.save
          SystemPromptGeneratorWorker.perform_async(assessment.id)
          json_response({ assessment:, system_prompt_generated: true }, :created)
        else
          json_error(assessment.errors.full_messages.first, :unprocessable_entity)
        end
      end

      # PUT /api/v1/assessments/:id
      def update
        if @assessment.update(assessment_params)
          SystemPromptGeneratorWorker.perform_async(@assessment.id)
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

      # Status filter operates on the LATEST session of each assessment.
      LATEST_STATUS_SQL = '(SELECT s.status FROM sessions s WHERE s.assessment_id = assessments.id ORDER BY s.created_at DESC, s.id DESC LIMIT 1)'
      LATEST_REASON_SQL = '(SELECT s.end_reason FROM sessions s WHERE s.assessment_id = assessments.id ORDER BY s.created_at DESC, s.id DESC LIMIT 1)'

      def filter_by_latest_session_status(scope, status)
        case status
        when 'awaiting'
          scope.where("NOT EXISTS (SELECT 1 FROM sessions s WHERE s.assessment_id = assessments.id) OR #{LATEST_STATUS_SQL} = 'pending'")
        when 'live'
          scope.where("#{LATEST_STATUS_SQL} = 'active'")
        when 'completed'
          # end_reason is an enum — NULL means "no reason set", which is fine.
          scope.where("#{LATEST_STATUS_SQL} = 'ended' AND #{LATEST_REASON_SQL} IS DISTINCT FROM 'error'")
        when 'failed'
          scope.where("#{LATEST_STATUS_SQL} = 'ended' AND #{LATEST_REASON_SQL} = 'error'")
        else
          scope
        end
      end

      def sort_clause
        case query_params[:sort]
        when 'oldest' then { created_at: :asc }
        when 'name'   then 'assessments.name ASC'
        else              { created_at: :desc }
        end
      end

      def sanitize_like(value)
        value.to_s.gsub(/[%_\\]/) { |m| "\\#{m}" }
      end
    end
  end
end
