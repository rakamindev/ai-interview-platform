# frozen_string_literal: true

module Api
  module V1
    class AssessmentsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_assessment, only: %i[show update destroy versions]

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

      # GET /api/v1/assessments/:id/versions
      # Versions are read-only published contracts used by candidate sessions.
      def versions
        versions = @assessment.assessment_versions
                              .includes(:assessment_version_skills)
                              .order(rubric_version: :desc)

        json_response(versions: versions.map(&method(:assessment_version_json)))
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
        @assessment.with_lock do
          @assessment.update!(assessment_params)
          @assessment.increment!(:rubric_version)
        end

        # Queue only after the locked transaction has committed. This prompt is a
        # mutable-template cache; candidate sessions use their published version.
        SystemPromptGeneratorWorker.perform_async(@assessment.id)
        json_response({ assessment: assessment_with_skills_json(@assessment), system_prompt_generated: true })
      rescue ActiveRecord::RecordInvalid => e
        json_error(e.record.errors.full_messages.first, :unprocessable_entity)
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

      def assessment_version_json(version)
        {
          id:             version.id,
          rubric_version: version.rubric_version,
          name:           version.name,
          time_limit_min: version.time_limit_min,
          language:       version.language,
          created_at:     version.created_at,
          skills: version.assessment_version_skills.sort_by(&:display_order).map do |skill|
            {
              skill_id:       skill.skill_id,
              skill_label:    skill.skill_label,
              is_custom:      skill.is_custom,
              scope_include:  skill.scope_include,
              scope_exclude:  skill.scope_exclude,
              l1_anchor:      skill.l1_anchor,
              l2_anchor:      skill.l2_anchor,
              l3_anchor:      skill.l3_anchor,
              l4_anchor:      skill.l4_anchor,
              l5_anchor:      skill.l5_anchor,
              expected_level: skill.expected_level,
              display_order:  skill.display_order
            }
          end
        }
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
