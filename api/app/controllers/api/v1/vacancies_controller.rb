# frozen_string_literal: true

module Api
  module V1
    class VacanciesController < ApiController
      authorize_auth_token! :assessor

      before_action :set_vacancy, only: %i[show update destroy]

      # GET /api/v1/vacancies
      #
      # Cached per (data generation, tenant, page, per_page) — same
      # invalidation pattern as the assessments index.
      def index
        payload = Rails.cache.fetch(index_cache_key, expires_in: 2.minutes) do
          vacancies = paginate(Vacancy.order(created_at: :desc))

          {
            vacancies: serialize(vacancies, with: VacancySerializer),
            meta: pagination_meta(vacancies)
          }
        end

        json_response(payload)
      end

      # GET /api/v1/vacancies/:id
      def show
        json_response(vacancy: serialize(@vacancy, with: VacancySerializer, with_skills: true))
      end

      # POST /api/v1/vacancies
      def create
        vacancy = Vacancy.new(vacancy_params)
        vacancy.created_by = current_user.id

        if vacancy.save
          json_response({ vacancy: serialize(vacancy, with: VacancySerializer, with_skills: true) }, :created)
        else
          json_error(vacancy.errors.full_messages.first, :unprocessable_entity)
        end
      end

      # PUT /api/v1/vacancies/:id
      def update
        if @vacancy.update(vacancy_params)
          json_response(vacancy: serialize(@vacancy, with: VacancySerializer, with_skills: true))
        else
          json_error(@vacancy.errors.full_messages.first, :unprocessable_entity)
        end
      end

      # DELETE /api/v1/vacancies/:id
      def destroy
        @vacancy.destroy
        json_response(message: "Vacancy deleted")
      end

      private

      def index_cache_key
        page     = query_params[:page] || 1
        per_page = query_params[:per_page] || 20
        "vacancies:v#{Vacancy.cache_version}:t#{current_tenant_id}:p#{page}:pp#{per_page}"
      end

      def set_vacancy
        @vacancy = Vacancy.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Vacancy not found", :not_found)
      end

      def vacancy_params
        params.require(:vacancy).permit(
          :role_title,
          :culture_dimensions,
          :competency_expectations,
          vacancy_skills_attributes: %i[
            id skill_id skill_label expected_level _destroy
          ]
        )
      end

    end
  end
end
