# frozen_string_literal: true

module Api
  module V1
    class AssessmentsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_assessment, only: %i[show update destroy system_prompt]

      # GET /api/v1/assessments
      def index
        assessments = paginate(
          Assessment.includes(:sessions).order(created_at: :desc)
        )

        json_response(
          assessments: assessments.map(&method(:assessment_list_json)),
          meta: pagination_meta(assessments)
        )
      end

      # GET /api/v1/assessments/:id
      def show
        json_response(assessment: assessment_with_skills_json(@assessment))
      end

      # POST /api/v1/assessments
      # Accepts create_session: true to also create the first pending session
      # and return its invite URL in one action (PRD-02 Phase 1).
      def create
        assessment = Assessment.new(assessment_params)
        assessment.created_by = current_user.id

        if assessment.save
          SystemPromptGeneratorWorker.perform_async(assessment.id)
          payload = { assessment:, system_prompt_generated: true }

          if create_session_requested?
            session = assessment.sessions.build(tenant_id: current_tenant_id)
            if session.save
              payload[:session] = {
                id: session.id,
                status: session.status,
                invite_url: session.invite_url,
                expires_at: session.expires_at
              }
              payload[:invite_url] = session.invite_url
            else
              payload[:session_error] = session.errors.full_messages.first
            end
          end

          json_response(payload, :created)
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

      # GET /api/v1/assessments/:id/system_prompt
      # Returns the compiled system prompt (PRD-01 §2) — stored if the generator
      # worker has run, otherwise compiled fresh from the saved config.
      def system_prompt
        prompt = @assessment.system_prompt.presence ||
                 Assessments::SystemPromptCompiler.new(@assessment).call

        json_response(system_prompt: prompt)
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
          :role_title,
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

      def create_session_requested?
        %w[true 1].include?(params[:create_session].to_s)
      end

      def assessment_json(assessment)
        assessment_base_json(assessment).merge(
          system_prompt: assessment.system_prompt
        )
      end

      # Lightweight list projection: the list UI only needs base fields and the
      # latest session summary — no skills, and not the heavy system_prompt text
      # (clients use GET /assessments/:id/system_prompt for that).
      def assessment_list_json(assessment)
        assessment_base_json(assessment)
      end

      def assessment_base_json(assessment)
        latest = assessment.sessions.max_by(&:created_at)

        {
          id:             assessment.id,
          name:           assessment.name,
          role_title:     assessment.role_title.presence || assessment.name,
          time_limit_min: assessment.time_limit_min,
          language:       assessment.language || 'en',
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
