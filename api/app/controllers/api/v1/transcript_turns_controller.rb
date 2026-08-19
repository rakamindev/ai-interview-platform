# frozen_string_literal: true

module Api
  module V1
    class TranscriptTurnsController < ApiController
      authorize_auth_token! :assessor

      def revise
        turn = TranscriptTurn.find(params[:id])
        revision = turn.transcript_revisions.create!(revision_params.merge(revised_by: current_user.id))
        json_response({ revision: revision_json(revision) }, :created)
      rescue ActiveRecord::RecordNotFound
        json_error('Transcript turn not found', :not_found)
      rescue ActiveRecord::RecordInvalid => error
        json_error(error.record.errors.full_messages.first, :unprocessable_entity)
      end

      private

      def revision_params
        params.require(:revision).permit(:revised_text, :reason)
      end

      def revision_json(revision)
        {
          id: revision.id,
          transcript_turn_id: revision.transcript_turn_id,
          revised_text: revision.revised_text,
          reason: revision.reason,
          revised_by: revision.revised_by,
          created_at: revision.created_at
        }
      end
    end
  end
end
