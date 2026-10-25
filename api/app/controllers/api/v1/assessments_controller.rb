# frozen_string_literal: true

module Api
  module V1
    class AssessmentsController < ApiController
      authorize_auth_token! :admin

      before_action :set_assessment, only: %i[show update destroy archive unarchive]

      # GET /api/v1/assessments
      def index
        assessments = paginate(
          filtered_assessment_scope.includes(:sessions).order(created_at: :desc)
        )

        json_response(
          assessments: assessments.map(&method(:assessment_json)),
          meta: pagination_meta(assessments).merge(
            active_count: Assessment.active.count,
            archived_count: Assessment.archived.count
          )
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
        if @assessment.destroy
          json_response({ message: "Assessment deleted" })
        else
          json_error(
            @assessment.errors.full_messages.first.presence ||
              "Assessment cannot be deleted while it has sessions",
            :conflict
          )
        end
      end

      def archive
        Assessment.transaction do
          mark_unfinished_sessions_failed(@assessment)
          @assessment.update!(archived_at: Time.current)
        end
        json_response(message: "Assessment archived")
      end

      def unarchive
        @assessment.update!(archived_at: nil)
        json_response(message: "Assessment restored")
      end

      def bulk_archive
        ids = Array(params[:ids]).filter_map { |id| Integer(id, exception: false) }
        archived = 0
        Assessment.transaction do
          assessments = Assessment.active.where(id: ids)
          assessments.each { |assessment| mark_unfinished_sessions_failed(assessment) }
          archived = assessments.update_all(archived_at: Time.current)
        end
        json_response(message: "Assessments archived", archived_count: archived)
      end

      def bulk_unarchive
        ids = Array(params[:ids]).filter_map { |id| Integer(id, exception: false) }
        restored = Assessment.archived.where(id: ids).update_all(archived_at: nil, updated_at: Time.current)

        json_response(message: "Assessments restored", restored_count: restored)
      end

      private

      def assessment_scope
        params[:archived].to_s == "true" ? Assessment.archived : Assessment.active
      end

      def filtered_assessment_scope
        search = params[:search].to_s.strip
        return assessment_scope if search.blank?

        assessment_scope.where(
          "name ILIKE ?",
          "%#{ActiveRecord::Base.sanitize_sql_like(search)}%"
        )
      end

      def mark_unfinished_sessions_failed(assessment)
        ended_at = Time.current

        assessment.sessions.where(status: %w[pending active]).find_each do |session|
          session.update!(
            status: 'ended',
            end_reason: 'error',
            ended_at: ended_at,
            duration_seconds: session.started_at ? (ended_at - session.started_at).to_i : nil
          )
        end
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
          archived_at:    assessment.archived_at,
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
