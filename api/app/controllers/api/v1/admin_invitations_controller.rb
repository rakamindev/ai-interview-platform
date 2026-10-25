# frozen_string_literal: true

module Api
  module V1
    class AdminInvitationsController < ApiController
      skip_before_action :require_tenant!
      authorize_auth_token! :admin
      before_action :load_persisted_admin!

      def index
        invitations = AdministratorInvitation
                      .for_tenant(@persisted_admin.tenant_id)
                      .includes(:inviter, :organization)
                      .recent_first

        json_response({ invitations: invitations.map { |invitation| serialize(invitation) } })
      end

      def create
        invitation, raw_token = AdministratorInvitations::Issuer.call(
          inviter: @persisted_admin,
          email: params[:email]
        )

        json_response(
          {
            invitation: serialize(invitation),
            signup_url: signup_url(raw_token)
          },
          :created
        )
      rescue ActiveRecord::RecordInvalid => e
        json_error(e.record.errors.full_messages.first, :unprocessable_entity)
      end

      def revoke
        invitation = AdministratorInvitation
                     .for_tenant(@persisted_admin.tenant_id)
                     .find(params[:id])

        invitation.with_lock do
          if invitation.accepted_at.present? || invitation.expires_at.past?
            return json_error('Only active invitations can be revoked', :unprocessable_entity)
          end

          invitation.update!(revoked_at: Time.current) if invitation.revoked_at.nil?
        end

        json_response({ invitation: serialize(invitation.reload) })
      end

      private

      def load_persisted_admin!
        @persisted_admin = User.includes(:organization).find_by(id: current_user&.id)
        valid_admin = @persisted_admin&.role == 'admin' &&
                      @persisted_admin.tenant_id == current_organization&.id

        raise ExceptionHandler::Unauthorized, Message.unauthorized unless valid_admin
      end

      def signup_url(raw_token)
        base_url = ENV.fetch('FRONTEND_BASE_URL', 'http://localhost:5173').chomp('/')
        query = Rack::Utils.build_query(invitation: raw_token)
        "#{base_url}/signup?#{query}"
      end

      def serialize(invitation)
        {
          id: invitation.id,
          recipient_email: invitation.recipient_email,
          status: invitation.status,
          expires_at: invitation.expires_at,
          accepted_at: invitation.accepted_at,
          revoked_at: invitation.revoked_at,
          created_at: invitation.created_at,
          inviter_email: invitation.inviter.email,
          organization: {
            id: invitation.organization.id,
            name: invitation.organization.name
          }
        }
      end
    end
  end
end
