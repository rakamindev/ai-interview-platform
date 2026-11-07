# frozen_string_literal: true

module Api
  module V1
    class VacanciesController < ApiController
      authorize_auth_token! :assessor

      before_action :set_vacancy, only: %i[show update destroy]
      before_action :process_custom_skills, only: %i[create update]

      # GET /api/v1/vacancies
      def index
        vacancies = paginate(Vacancy.order(created_at: :desc))

        json_response(
          vacancies: vacancies.map(&method(:vacancy_json)),
          meta: pagination_meta(vacancies)
        )
      end

      # GET /api/v1/vacancies/:id
      def show
        json_response(vacancy: vacancy_with_skills_json(@vacancy))
      end

      # POST /api/v1/vacancies
      def create
        vacancy = Vacancy.new(vacancy_params)
        vacancy.created_by = current_user.id

        if vacancy.save
          json_response({ vacancy: vacancy_with_skills_json(vacancy) }, :created)
        else
          json_error(vacancy.errors.full_messages.first, :unprocessable_entity)
        end
      end

      # PUT /api/v1/vacancies/:id
      def update
        if @vacancy.update(vacancy_params)
          json_response(vacancy: vacancy_with_skills_json(@vacancy))
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

      def process_custom_skills
        return unless params[:vacancy].key?(:vacancy_skills_attributes)

        params[:vacancy][:vacancy_skills_attributes].each do |skill_attr|
          if skill_attr[:skill_id].blank? && skill_attr[:is_custom] == true
            clean_label = skill_attr[:skill_label].to_s.strip.squeeze(" ")
            next if clean_label.blank?

            taxonomy = SkillTaxonomy.where("LOWER(skill_label) = ?", clean_label.downcase).first_or_create!(
              skill_label: clean_label,
              category: "engineering",
              l1_anchor: "Baseline expectation for custom skill.",
              l2_anchor: "Routine execution capability.",
              l3_anchor: "Proficient capability in execution.",
              l4_anchor: "Advanced mastery level.",
              l5_anchor: "Expert leadership and guidance."
            )

            skill_attr[:skill_id] = taxonomy.skill_id
          end
        end
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
            id skill_id skill_label expected_level is_custom _destroy # [DITAMBAHKAN] Menambahkan :is_custom ke permitted params
          ]
        )
      end

      def vacancy_json(vacancy)
        {
          id:                     vacancy.id,
          role_title:             vacancy.role_title,
          culture_dimensions:     vacancy.culture_dimensions,
          competency_expectations: vacancy.competency_expectations,
          created_by:             vacancy.created_by,
          created_at:             vacancy.created_at,
          updated_at:             vacancy.updated_at
        }
      end

      def vacancy_with_skills_json(vacancy)
        skills = vacancy.vacancy_skills

        skill_ids    = skills.filter_map(&:skill_id).uniq
        taxonomy_map = SkillTaxonomy.where(skill_id: skill_ids).index_by(&:skill_id)

        vacancy_json(vacancy).merge(
          skills: skills.map { |s| vacancy_skill_json(s, taxonomy_map[s.skill_id]) }
        )
      end

      def vacancy_skill_json(skill, taxonomy)
        {
          id:             skill.id,
          skill_id:       skill.skill_id,
          skill_label:    skill.skill_label,
          expected_level: skill.expected_level,
          l1_anchor:      taxonomy&.l1_anchor,
          l2_anchor:      taxonomy&.l2_anchor,
          l3_anchor:      taxonomy&.l3_anchor,
          l4_anchor:      taxonomy&.l4_anchor,
          l5_anchor:      taxonomy&.l5_anchor
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