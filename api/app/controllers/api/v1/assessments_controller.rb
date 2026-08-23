# frozen_string_literal: true

module Api
    module V1
        class AssessmentsController < ApiController
            authorize_auth_token! :assessor

            before_action :set_assessment, only: %i[show update destroy]

            # GET /api/v1/assessments
            def index
                cache_key = [
                    Current.tenant_id,
                    Assessment.model_name.cache_key,
                    'index',
                    params.to_unsafe_h.sort.to_h,
                    Assessment.cache_version
                ]

                result = Rails.cache.fetch(cache_key, expires_in: 1.day) do
                    assessments = paginate(Assessment.includes(:sessions, :vacancy)
                                               .joins(:vacancy)
                                               .order(
                                                   Arel.sql(
                                                       "CASE WHEN vacancies.status = '#{Vacancy::STATUS.completed}' THEN 1 ELSE 0 END"
                                                   ),
                                                   created_at: :desc
                                               ))
                    {
                        assessments: assessments.map { |assessment| ::Api::V1::AssessmentSerializer.list(assessment) },
                        counters: {
                            running: Assessment.joins(:vacancy).where(vacancies: { status: Vacancy::STATUS.running }).count,
                            completed: Assessment.joins(:vacancy).where(vacancies: { status: Vacancy::STATUS.completed }).count,
                            draft: Assessment.joins(:vacancy).where(vacancies: { status: Vacancy::STATUS.draft }).count,
                        },
                        meta: ::Api::V1::AssessmentSerializer.pagination_meta(assessments),
                    }
                end

                json_response(result)
            end

            # GET /api/v1/assessments/:id
            def show
                cache_key = [
                    Current.tenant_id,
                    Assessment.model_name.cache_key,
                    'show',
                    params[:id],
                    Assessment.cache_version
                ]

                result = Rails.cache.fetch(cache_key, expires_in: 1.day) do
                    {
                        assessment: ::Api::V1::AssessmentSerializer.detail_with_skills(@assessment)
                    }
                end

                json_response(result)
            end

            # POST /api/v1/assessments
            def create
                assessment = Assessment.new(assessment_params)
                assessment.created_by = current_user.id

                if assessment.save
                    # SystemPromptGeneratorWorker.perform_async(assessment.id)
                    json_response({ assessment:, system_prompt_generated: true }, :created)
                else
                    json_error(assessment.errors.full_messages.join(', '), :unprocessable_entity)
                end
            end

            # PUT /api/v1/assessments/:id
            def update
                if @assessment.update(assessment_params)
                    # SystemPromptGeneratorWorker.perform_async(@assessment.id)
                    json_response({ assessment: AssessmentSerializer.detail_with_skills(@assessment),
                                    system_prompt_generated: true })
                else
                    json_error(@assessment.errors.full_messages.join(', '), :unprocessable_entity)
                end
            end

            # DELETE /api/v1/assessments/:id
            def destroy
                @assessment.destroy
                json_response({ message: 'Assessment deleted' })
            end

            private

            def set_assessment

                cache_key = [
                    Current.tenant_id,
                    Assessment.model_name.cache_key,
                    params[:id],
                    Assessment.cache_version
                ]

                @assessment = Rails.cache.fetch(cache_key, expires_in: 1.day) do
                    Assessment.find(params[:id])
                end

            rescue ActiveRecord::RecordNotFound
                json_error('Assessment not found', :not_found)
            end

            def assessment_params
                params.require(:assessment).permit(
                    :vacancy_id,
                    :time_limit_min,
                    :language,
                    assessment_skills_attributes: %i[
                        id skill_taxonomy_id is_custom
                        scope_include scope_exclude
                        l1_anchor l2_anchor l3_anchor l4_anchor l5_anchor
                        expected_level display_order _destroy
                    ]
                )
            end

        end
    end
end
