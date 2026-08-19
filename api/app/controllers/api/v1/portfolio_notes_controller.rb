# frozen_string_literal: true

module Api
  module V1
    class PortfolioNotesController < ApiController
      authorize_auth_token! :assessor

      def create
        portfolio = tenant_portfolios.find(params[:portfolio_id])
        note = portfolio.portfolio_notes.create!(note_params.merge(created_by: current_user.id))
        json_response({ note: note_json(note) }, :created)
      rescue ActiveRecord::RecordNotFound
        json_error('Portfolio not found', :not_found)
      rescue ActiveRecord::RecordInvalid => error
        json_error(error.record.errors.full_messages.first, :unprocessable_entity)
      end

      def index
        portfolio = tenant_portfolios.find(params[:portfolio_id])
        json_response(notes: portfolio.portfolio_notes.order(created_at: :desc).map { |note| note_json(note) })
      rescue ActiveRecord::RecordNotFound
        json_error('Portfolio not found', :not_found)
      end

      private

      def note_params
        params.require(:note).permit(:body, :category)
      end

      def note_json(note)
        note.slice(:id, :portfolio_id, :body, :category, :created_by, :created_at)
      end

      def tenant_portfolios
        Portfolio.joins(:session).where(sessions: { tenant_id: current_tenant_id })
      end
    end
  end
end
