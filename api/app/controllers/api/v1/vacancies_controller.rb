# frozen_string_literal: true

module Api
  module V1
    class VacanciesController < ApiController
      authorize_auth_token! :admin

      before_action :set_vacancy, only: %i[show update destroy archive unarchive]

      # GET /api/v1/vacancies
      def index
        vacancies = paginate(filtered_vacancy_scope.order(created_at: :desc))

        json_response(
          vacancies: vacancies.map(&method(:vacancy_json)),
          meta: pagination_meta(vacancies).merge(
            active_count: Vacancy.active.count,
            archived_count: Vacancy.archived.count
          )
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
        if RetentionPolicy.vacancy_action(has_fit_gap_reports: @vacancy.fit_gap_reports.exists?) == :archive
          @vacancy.update!(archived_at: Time.current)
          json_response(message: "Vacancy archived; Fit/Gap reports preserved")
        elsif @vacancy.destroy
          json_response(message: "Vacancy deleted")
        else
          json_error(@vacancy.errors.full_messages.first || "Vacancy could not be deleted", :conflict)
        end
      end

      def archive
        @vacancy.update!(archived_at: Time.current)
        json_response(message: "Vacancy archived; Fit/Gap reports preserved")
      end

      def unarchive
        @vacancy.update!(archived_at: nil)
        json_response(message: "Vacancy restored")
      end

      def bulk_archive
        ids = Array(params[:ids]).filter_map { |id| Integer(id, exception: false) }
        archived = Vacancy.active.where(id: ids).update_all(archived_at: Time.current)
        json_response(message: "Vacancies archived", archived_count: archived)
      end

      def bulk_unarchive
        ids = Array(params[:ids]).filter_map { |id| Integer(id, exception: false) }
        restored = Vacancy.archived.where(id: ids).update_all(archived_at: nil, updated_at: Time.current)
        json_response(message: "Vacancies restored", restored_count: restored)
      end

      private

      def vacancy_scope
        params[:archived].to_s == "true" ? Vacancy.archived : Vacancy.active
      end

      def filtered_vacancy_scope
        search = params[:search].to_s.strip
        return vacancy_scope if search.blank?

        vacancy_scope.where(
          "role_title ILIKE ?",
          "%#{ActiveRecord::Base.sanitize_sql_like(search)}%"
        )
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

      def vacancy_json(vacancy)
        {
          id:                       vacancy.id,
          role_title:               vacancy.role_title,
          culture_dimensions:       vacancy.culture_dimensions,
          competency_expectations:  vacancy.competency_expectations,
          created_by:               vacancy.created_by,
          created_at:               vacancy.created_at,
          updated_at:               vacancy.updated_at,
          archived_at:              vacancy.archived_at
        }
      end

      def vacancy_with_skills_json(vacancy)
        skills = vacancy.vacancy_skills

        # Preload taxonomy anchors in one query to avoid N+1
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
