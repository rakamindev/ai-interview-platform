# frozen_string_literal: true

module Api
  module V1
    class CvScreeningsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_cv_screening, only: %i[show update]

      # GET /api/v1/cv_screenings
      def index
        screenings = paginate(CvScreening.order(created_at: :desc))

        json_response(
          cv_screenings: screenings.map(&method(:cv_screening_json)),
          meta:          pagination_meta(screenings)
        )
      end

      # POST /api/v1/cv_screenings
      def create
        screening = CvScreening.new(cv_screening_params)
        screening.created_by = current_user.id

        if screening.save
          json_response({ cv_screening: cv_screening_json(screening) }, :created)
        else
          json_error(screening.errors.full_messages.first, :unprocessable_entity)
        end
      end

      # GET /api/v1/cv_screenings/:id
      def show
        json_response(cv_screening: cv_screening_with_summary_json(@cv_screening))
      end

      # PATCH /api/v1/cv_screenings/:id
      def update
        if @cv_screening.update(cv_screening_update_params)
          json_response(cv_screening: cv_screening_with_summary_json(@cv_screening))
        else
          json_error(@cv_screening.errors.full_messages.first, :unprocessable_entity)
        end
      end

      private

      def set_cv_screening
        @cv_screening = CvScreening.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error('CV screening not found', :not_found)
      end

      def cv_screening_params
        params.require(:cv_screening).permit(:name, :vacancy_id, :assessment_id, :threshold)
      end

      def cv_screening_update_params
        params.require(:cv_screening).permit(:vacancy_id, :assessment_id, :threshold)
      end

      def cv_screening_json(screening)
        {
          id:             screening.id,
          name:           screening.name,
          vacancy_id:     screening.vacancy_id,
          assessment_id:  screening.assessment_id,
          threshold:      screening.threshold,
          created_by:     screening.created_by,
          created_at:     screening.created_at,
          updated_at:     screening.updated_at
        }
      end

      def cv_screening_with_summary_json(screening)
        counts = screening.cv_screening_entries.group(:decision).count

        cv_screening_json(screening).merge(
          summary: {
            total:         counts.values.sum,
            pending:       counts.fetch('pending', 0),
            needs_review:  counts.fetch('needs_review', 0),
            invited:       counts.fetch('invited', 0),
            not_advanced:  counts.fetch('not_advanced', 0)
          }
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
