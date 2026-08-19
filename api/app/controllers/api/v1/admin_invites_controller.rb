# frozen_string_literal: true

module Api
  module V1
    class AdminInvitesController < ApiController
      authorize_auth_token! :admin, except: %i[show accept]
      skip_before_action :require_tenant!, only: %i[show accept]

      # GET /api/v1/admin_invites
      # GET /api/v1/admin_invites?q=budi&page=2
      def index
        scope = AdminInvite.all
        scope = scope.where('email ILIKE ?', "%#{params[:q]}%") if params[:q].present?
        invites = paginate(scope.order(created_at: :desc))

        json_response(
          admin_invites: invites.map(&method(:admin_invite_json)),
          meta: pagination_meta(invites)
        )
      end

      # POST /api/v1/admin_invites
      def create
        email = params.dig(:admin_invite, :email).to_s.strip.downcase
        role  = params.dig(:admin_invite, :role).to_s

        return json_error("Email is required", :unprocessable_entity) if email.blank?
        unless AdminInvite::ROLES.include?(role)
          return json_error("Role must be one of: #{AdminInvite::ROLES.join(', ')}", :unprocessable_entity)
        end

        # Only one active link per invitee — revoke any still-pending invite first.
        AdminInvite.pending.where(tenant_id: current_tenant_id, email:).update_all(expires_at: Time.current)

        invite = AdminInvite.new(email:, role:, created_by: current_user.id)

        if invite.save
          json_response({ admin_invite: admin_invite_json(invite) }, :created)
        else
          json_error(invite.errors.full_messages.first, :unprocessable_entity)
        end
      end

      # GET /admin_invites/:token  — no JWT, invite token in URL
      def show
        invite = AdminInvite.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid invite link", :not_found) unless invite
        return json_error("This invite has expired", :gone) if invite.expired?
        return json_error("This invite has already been used", :gone) if invite.accepted?

        json_response(email: invite.email, role: invite.role)
      end

      # POST /admin_invites/:token/accept  — no JWT, invite token in URL
      def accept
        invite = AdminInvite.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid invite link", :not_found) unless invite
        return json_error("This invite has expired", :gone) if invite.expired?
        return json_error("This invite has already been used", :gone) if invite.accepted?

        password = params[:password].to_s
        if password.length < 8
          return json_error("Password must be at least 8 characters", :unprocessable_entity)
        end
        unless password == params[:password_confirmation].to_s
          return json_error("Passwords don't match", :unprocessable_entity)
        end

        user = User.find_or_initialize_by(email: invite.email)
        user.role = invite.role == 'assessor' ? 'admin' : invite.role # only 'admin' role can log in today
        user.password = password
        user.password_confirmation = password

        if user.save
          invite.update!(accepted_at: Time.current)
          json_response(message: "Account created — you can now log in")
        else
          json_error(user.errors.full_messages.first, :unprocessable_entity)
        end
      end

      private

      def admin_invite_json(invite)
        {
          id:          invite.id,
          email:       invite.email,
          role:        invite.role,
          invite_url:  invite.invite_url,
          expires_at:  invite.expires_at,
          accepted_at: invite.accepted_at,
          usable:      invite.usable?,
          created_at:  invite.created_at
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
