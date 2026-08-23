# frozen_string_literal: true

module Api
    module V1
        class VacanciesController < ApiController
            authorize_auth_token! :assessor

            before_action :set_vacancy, only: %i[show update destroy]

            # GET /api/v1/vacancies
            def index
                cache_key = [
                    Current.tenant_id,
                    Vacancy.model_name.cache_key,
                    'index',
                    params.to_unsafe_h.sort.to_h,
                    Vacancy.cache_version
                ]

                result = Rails.cache.fetch(cache_key, expires_in: 1.day) do
                    vacancies = Vacancy.order(
                        Arel.sql(
                            "CASE status
                             WHEN 'running' THEN 1
                             WHEN 'draft' THEN 2
                             WHEN 'completed' THEN 3
                             END"
                        ),
                        created_at: :desc
                    )

                    vacancies = vacancies.where(status: params[:status]) if params[:status].present?

                    if params[:q].present?
                        q = "%#{params[:q]}%"

                        vacancies = vacancies.where(
                            'role_title ILIKE :q
                             OR culture_dimensions ILIKE :q
                             OR competency_expectations ILIKE :q',
                            q: q
                        )
                    end

                    vacancies = paginate(vacancies)

                    {
                        vacancies: vacancies.map { |vacancy|  ::Api::V1::VacancySerializer.list(vacancy)},
                        counters: {
                            running: Vacancy.where(status: Vacancy::STATUS.running).count,
                            completed: Vacancy.where(status: Vacancy::STATUS.completed).count,
                            draft: Vacancy.where(status: Vacancy::STATUS.draft).count,
                        },
                        meta: ::Api::V1::VacancySerializer.pagination_meta(vacancies)
                    }
                end

                json_response(result)
            end

            # GET /api/v1/vacancies/options
            def options
                cache_key = [
                    Current.tenant_id,
                    Vacancy.model_name.cache_key,
                    'options',
                    Vacancy.cache_version
                ]

                result = Rails.cache.fetch(cache_key, expires_in: 1.day) do
                    vacancies = Vacancy
                                    .left_joins(:assessment)
                                    .where(status: [Vacancy::STATUS.running, Vacancy::STATUS.draft])
                                    .where(assessment: { id: nil })
                                    .order(:role_title)

                    {
                        vacancies: vacancies.map do |vacancy|
                            ::Api::V1::VacancySerializer.list(vacancy)
                        end
                    }
                end

                json_response(result)
            end

            # GET /api/v1/vacancies/:id
            def show
                cache_key = [
                    Current.tenant_id,
                    Vacancy.model_name.cache_key,
                    'show',
                    params[:id],
                    Vacancy.cache_version
                ]

                result = Rails.cache.fetch(cache_key, expires_in: 1.day) do
                    {
                        vacancy: ::Api::V1::VacancySerializer.detail_with_skills(@vacancy)
                    }
                end

                json_response(result)
            end

            # POST /api/v1/vacancies
            def create
                vacancy = Vacancy.new(vacancy_params)
                vacancy.created_by = current_user.id

                if vacancy.save
                    if Rails.env.development?
                        json_response(
                            {
                                vacancy: ::Api::V1::VacancySerializer.detail_with_skills(vacancy)
                            },
                            :created
                        )
                    else
                        json_response({ success: true })
                    end
                else
                    json_error(
                        vacancy.errors.full_messages.join(', '),
                        :unprocessable_entity
                    )
                end
            end

            # PUT /api/v1/vacancies/:id
            def update
                if @vacancy.update(vacancy_params)
                    json_response(
                        vacancy: ::Api::V1::VacancySerializer.detail_with_skills(@vacancy)
                    )
                else
                    json_error(
                        @vacancy.errors.full_messages.join(', '),
                        :unprocessable_entity
                    )
                end
            end

            # DELETE /api/v1/vacancies/:id
            def destroy
                @vacancy.destroy

                json_response(message: 'Vacancy deleted')
            end

            private

            def set_vacancy
                cache_key = [
                    Current.tenant_id,
                    Vacancy.model_name.cache_key,
                    params[:id],
                    Vacancy.cache_version
                ]

                @vacancy = Rails.cache.fetch(cache_key, expires_in: 1.day) do
                    Vacancy.find(params[:id])
                end
            rescue ActiveRecord::RecordNotFound
                json_error('Vacancy not found', :not_found)
            end

            def vacancy_params
                params.require(:vacancy).permit(
                    :role_title,
                    :status,
                    :culture_dimensions,
                    :competency_expectations,
                    vacancy_skills_attributes: %i[
                        id
                        skill_taxonomy_id
                        expected_level
                        _destroy
                    ]
                )
            end
        end
    end
end