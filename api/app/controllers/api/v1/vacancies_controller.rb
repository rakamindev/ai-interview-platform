
# frozen_string_literal: true

module Api
  module V1
    class VacanciesController < ApiController
      authorize_auth_token! :assessor

      before_action :set_vacancy, only: %i[show update destroy]

      def index
        scope = Vacancy
          .includes(:vacancy_skills)
          .order(created_at: :desc)

        if params[:q].present?
          search = ActiveRecord::Base.sanitize_sql_like(
            params[:q].strip
          )

          scope = scope.where(
            "vacancies.role_title ILIKE ?",
            "%#{search}%"
          )
        end

        vacancies = paginate(scope)

        json_response(
          vacancies: vacancies.map(&method(:vacancy_list_json)),
          meta: pagination_meta(vacancies)
        )
      end

      def show
        json_response(
          vacancy: vacancy_with_skills_json(@vacancy)
        )
      end

      def create
        vacancy = Vacancy.new(vacancy_params)
        vacancy.created_by = current_user.id

        if vacancy.save
          json_response(
            {
              vacancy: vacancy_with_skills_json(vacancy)
            },
            :created
          )
        else
          json_error(
            vacancy.errors.full_messages.first,
            :unprocessable_entity
          )
        end
      end

      def update
        if @vacancy.update(vacancy_params)
          json_response(
            vacancy: vacancy_with_skills_json(@vacancy)
          )
        else
          json_error(
            @vacancy.errors.full_messages.first,
            :unprocessable_entity
          )
        end
      end

      def destroy
        if @vacancy.destroy
          json_response(
            message: "Vacancy deleted"
          )
        else
          json_error(
            @vacancy.errors.full_messages.first ||
              "Failed to delete vacancy",
            :unprocessable_entity
          )
        end
      end

      private

      def set_vacancy
        @vacancy = Vacancy.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error(
          "Vacancy not found",
          :not_found
        )
      end

      def vacancy_params
        params.require(:vacancy).permit(
          :role_title,
          :culture_dimensions,
          :competency_expectations,
          vacancy_skills_attributes: %i[
            id
            skill_id
            skill_label
            expected_level
            _destroy
          ]
        )
      end

      def vacancy_json(vacancy)
        {
          id: vacancy.id,
          role_title: vacancy.role_title,
          culture_dimensions: vacancy.culture_dimensions,
          competency_expectations: vacancy.competency_expectations,
          created_by: vacancy.created_by,
          created_at: vacancy.created_at,
          updated_at: vacancy.updated_at
        }
      end

      def vacancy_list_json(vacancy)
        vacancy_json(vacancy).merge(
          skills: vacancy.vacancy_skills.map do |skill|
            {
              id: skill.id,
              skill_id: skill.skill_id,
              skill_label: skill.skill_label,
              expected_level: skill.expected_level
            }
          end
        )
      end

      def vacancy_with_skills_json(vacancy)
        skills = vacancy.vacancy_skills

        skill_ids = skills.filter_map(&:skill_id).uniq

        taxonomy_map = SkillTaxonomy
          .where(skill_id: skill_ids)
          .index_by(&:skill_id)

        vacancy_json(vacancy).merge(
          skills: skills.map do |skill|
            vacancy_skill_json(
              skill,
              taxonomy_map[skill.skill_id]
            )
          end
        )
      end

      def vacancy_skill_json(skill, taxonomy)
        {
          id: skill.id,
          skill_id: skill.skill_id,
          skill_label: skill.skill_label,
          expected_level: skill.expected_level,
          l1_anchor: taxonomy&.l1_anchor,
          l2_anchor: taxonomy&.l2_anchor,
          l3_anchor: taxonomy&.l3_anchor,
          l4_anchor: taxonomy&.l4_anchor,
          l5_anchor: taxonomy&.l5_anchor
        }
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
