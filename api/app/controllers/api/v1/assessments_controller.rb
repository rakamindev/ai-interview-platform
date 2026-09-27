# frozen_string_literal: true

module Api
  module V1
    class AssessmentsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_assessment, only: %i[show update destroy]

      def index
        base_scope = Assessment.all

        session_counts = Session
          .where(
            assessment_id: base_scope.select(:id)
          )
          .group(:status)
          .count

        scope = base_scope
          .includes(:sessions)
          .order(created_at: :desc)

        if params[:q].present?
          search = ActiveRecord::Base.sanitize_sql_like(
            params[:q].strip
          )

          scope = scope.where(
            "assessments.name ILIKE ?",
            "%#{search}%"
          )
        end

        assessments = paginate(scope)

        json_response(
          assessments: assessments.map(&method(:assessment_json)),
          meta: pagination_meta(assessments).merge(
            session_counts: {
              total: session_counts.values.sum,
              by_status: session_counts.transform_keys do |status|
                status.nil? ? "unknown" : status.to_s
              end
            }
          )
        )
      end

      def show
        json_response(
          assessment: assessment_with_skills_json(@assessment)
        )
      end

      def create
        assessment = Assessment.new(assessment_params)
        assessment.created_by = current_user.id

        if assessment.save
          SystemPromptGeneratorWorker.perform_async(
            assessment.id
          )

          json_response(
            {
              assessment: assessment,
              system_prompt_generated: true
            },
            :created
          )
        else
          json_error(
            assessment.errors.full_messages.first,
            :unprocessable_entity
          )
        end
      end

      def update
        if @assessment.update(assessment_params)
          SystemPromptGeneratorWorker.perform_async(
            @assessment.id
          )

          json_response(
            {
              assessment: assessment_with_skills_json(@assessment),
              system_prompt_generated: true
            }
          )
        else
          json_error(
            @assessment.errors.full_messages.first,
            :unprocessable_entity
          )
        end
      end

      def destroy
        if @assessment.sessions.exists?
          return json_error(
            "Assessment cannot be deleted while it still has candidate sessions",
            :unprocessable_entity
          )
        end

        if @assessment.destroy
          json_response(
            message: "Assessment deleted"
          )
        else
          json_error(
            @assessment.errors.full_messages.first ||
              "Failed to delete assessment",
            :unprocessable_entity
          )
        end
      end

      private

      def set_assessment
        @assessment = Assessment.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error(
          "Assessment not found",
          :not_found
        )
      end

      def assessment_params
        params.require(:assessment).permit(
          :name,
          :time_limit_min,
          :language,
          assessment_skills_attributes: %i[
            id
            skill_id
            skill_label
            is_custom
            scope_include
            scope_exclude
            l1_anchor
            l2_anchor
            l3_anchor
            l4_anchor
            l5_anchor
            expected_level
            display_order
            _destroy
          ]
        )
      end

      def assessment_json(assessment)
        latest = assessment.sessions.max_by(
          &:created_at
        )

        {
          id: assessment.id,
          name: assessment.name,
          time_limit_min: assessment.time_limit_min,
          language: assessment.language || "en",
          system_prompt: assessment.system_prompt,
          created_by: assessment.created_by,
          created_at: assessment.created_at,
          updated_at: assessment.updated_at,
          latest_session: latest && {
            id: latest.id,
            status: latest.status,
            end_reason: latest.end_reason
          }
        }
      end

      def assessment_with_skills_json(assessment)
        assessment_json(assessment).merge(
          skills: assessment
            .assessment_skills
            .order(:display_order)
            .map do |skill|
              {
                id: skill.id,
                skill_id: skill.skill_id,
                skill_label: skill.skill_label,
                is_custom: skill.is_custom,
                scope_include: skill.scope_include,
                scope_exclude: skill.scope_exclude,
                l1_anchor: skill.l1_anchor,
                l2_anchor: skill.l2_anchor,
                l3_anchor: skill.l3_anchor,
                l4_anchor: skill.l4_anchor,
                l5_anchor: skill.l5_anchor,
                expected_level: skill.expected_level,
                display_order: skill.display_order
              }
            end
        )
      end

      def pagination_meta(collection)
        {
          current_page: collection.current_page,
          total_pages: collection.total_pages,
          total_count: collection.total_count,
          per_page: collection.limit_value
        }
      end
    end
  end
end