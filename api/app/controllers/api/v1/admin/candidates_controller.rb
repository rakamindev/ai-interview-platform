# frozen_string_literal: true

module Api
  module V1
    module Admin
      class CandidatesController < ApiController
        authorize_auth_token! :admin

        # DELETE /api/v1/admin/candidates/:id/biometrics
        def purge_biometrics
          candidate_id = params[:id]
          sessions = Session.where(candidate_id: candidate_id)

          if sessions.empty?
            return json_error("Candidate sessions not found", :not_found)
          end

          ActiveRecord::Base.transaction do
            sessions.find_each do |session|
              Sessions::DataRetentionPurger.new(session).call
            end
          end

          json_response(
            success: true,
            message: "All biometric data and transcripts for candidate ##{candidate_id} have been permanently purged",
            candidate_id: candidate_id,
            purged_sessions_count: sessions.count
          )
        rescue StandardError => e
          json_error("Failed to purge candidate biometrics: #{e.message}", :unprocessable_entity)
        end
      end
    end
  end
end
