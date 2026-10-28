# frozen_string_literal: true

module Api
  module V1
    class AssessmentsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_assessment, only: %i[show update destroy]

      # GET /api/v1/assessments
      def index
        scope = Assessment.includes(:sessions)

        if params[:search].present?
          scope = scope.where("assessments.name ILIKE ?", "%#{params[:search].strip}%")
        end

        if params[:status] == "uncomplete"
          # Assessments where at least one candidate hasn't finished (pending or active)
          incomplete_ids = Session.where(status: %w[pending active]).select(:assessment_id)
          scope = scope.where(id: incomplete_ids)
        elsif params[:status] == "completed"
          # Assessments with candidates and all of them ended
          completed_ids = Session.where(status: "ended").select(:assessment_id)
          incomplete_ids = Session.where(status: %w[pending active]).select(:assessment_id)
          scope = scope.where(id: completed_ids).where.not(id: incomplete_ids)
        elsif params[:status] == "no_candidates"
          scope = scope.where.not(id: Session.select(:assessment_id))
        end

        # Sorting: newest by created_at (default) or updated_at
        sort_field = params[:sort_by] == "updated_at" ? :updated_at : :created_at
        scope = scope.order(sort_field => :desc, :id => :desc)

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
        sessions = assessment.sessions
        total_candidates = sessions.size
        active_count = sessions.count { |s| s.status == "active" }
        pending_count = sessions.count { |s| s.status == "pending" }
        completed_count = sessions.count { |s| s.status == "ended" }

        # Overall candidate status:
        # If any candidate is not ended, it's 'uncomplete' (or 'active' if currently live)
        # If all candidates ended and > 0, it's 'completed'
        # If no candidates, it's 'no_candidates'
        overall_status = if total_candidates.zero?
                           "no_candidates"
                         elsif active_count.positive?
                           "active"
                         elsif pending_count.positive?
                           "uncomplete"
                         else
                           "completed"
                         end

        {
          id:                 assessment.id,
          name:               assessment.name,
          time_limit_min:     assessment.time_limit_min,
          language:           assessment.language || "en",
          system_prompt:      assessment.system_prompt,
          created_by:         assessment.created_by,
          created_at:         assessment.created_at,
          updated_at:         assessment.updated_at,
          candidate_count:    total_candidates,
          overall_status:     overall_status,
          candidates_summary: {
            total:     total_candidates,
            active:    active_count,
            pending:   pending_count,
            completed: completed_count
          },
          latest_session:     latest && {
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
