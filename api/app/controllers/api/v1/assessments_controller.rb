# frozen_string_literal: true

module Api
  module V1
    class AssessmentsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_assessment, only: %i[show update destroy]

      # GET /api/v1/assessments
      #
      # Cached per (data generation, tenant, page, per_page). The data
      # generation is bumped by Assessment/Session writes, so a cached page
      # can never serve stale rows; the tenant segment prevents cross-tenant
      # leakage. Short TTL is a safety net, not the invalidation mechanism.
      def index
        payload = Rails.cache.fetch(index_cache_key, expires_in: 2.minutes) do
          assessments = paginate(
            Assessment.with_latest_session.order(created_at: :desc)
          )

          {
            assessments: serialize(assessments, with: AssessmentSerializer),
            meta: pagination_meta(assessments)
          }
        end

        json_response(payload)
      end

      # GET /api/v1/assessments/:id
      def show
        json_response(assessment: serialize(@assessment, with: AssessmentSerializer, with_skills: true))
      end

      # POST /api/v1/assessments
      def create
        assessment = Assessment.new(assessment_params)
        assessment.created_by = current_user.id

        if assessment.save
          SystemPromptGeneratorWorker.perform_async(assessment.id)
          json_response({ assessment: serialize(assessment, with: AssessmentSerializer), system_prompt_generated: true }, :created)
        else
          json_error(assessment.errors.full_messages.first, :unprocessable_entity)
        end
      end

      # PUT /api/v1/assessments/:id
      def update
        if @assessment.update(assessment_params)
          SystemPromptGeneratorWorker.perform_async(@assessment.id)
          json_response({
            assessment: serialize(@assessment, with: AssessmentSerializer, with_skills: true),
            system_prompt_generated: true
          })
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

      def index_cache_key
        page     = query_params[:page] || 1
        per_page = query_params[:per_page] || 20
        "assessments:v#{Assessment.cache_version}:t#{current_tenant_id}:p#{page}:pp#{per_page}"
      end

      def set_assessment
        @assessment = Assessment.includes(:assessment_skills).find(params[:id])
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

    end
  end
end
