# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      include TokenIssuance

      skip_before_action :require_tenant!

      # POST /api/v1/auth/login
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error("Invalid email or password", :unauthorized, code: "invalid_credentials") unless user&.authenticate(params[:password])

        # API-FIX-01: User::ROLES allows "admin" and "user" — both may log in.
        # Per-endpoint authorization (authorize_auth_token!) enforces the actual
        # role gating; login itself only verifies credentials.
        scheme = resolve_scheme
        return json_error("Unable to determine organization. Please access via your organization's URL.", :unprocessable_entity, code: "tenant_unresolved") unless scheme.present?

        json_response(issue_session_for(user, scheme: scheme))
      end

      # POST /api/v1/auth/refresh
      def refresh
        verify_csrf!
        refresh_token_value = extract_refresh_token
        return json_error("Missing refresh token", :unauthorized, details: "missing_refresh_token", code: "refresh_token_missing") unless refresh_token_value

        token_record = RefreshToken.find_by(token_hash: token_hash(refresh_token_value))
        return json_error("Invalid refresh token", :unauthorized, details: "invalid_refresh_token", code: "refresh_token_invalid") unless token_record

        if token_record.used_at.present? && token_record.grace_period_expired?
          # Same rotated-away token replayed after the grace window: treat as theft, kill the whole session family.
          # Must run before the valid_token? check below — a grace-expired
          # reused token is also !valid_token?, which would otherwise mask
          # this as a generic "invalid_refresh_token" and skip revocation.
          RefreshToken.revoke_all_for_user(token_record.user_id)
          return json_error("Refresh token reuse detected", :unauthorized, details: "refresh_token_reused", code: "refresh_token_reuse")
        end

        return json_error("Invalid refresh token", :unauthorized, details: "invalid_refresh_token", code: "refresh_token_invalid") unless token_record.valid_token?

        new_token = issue_refresh_token(token_record.user_id)
        store_refresh_cookie(new_token)
        token_record.mark_used! if token_record.used_at.nil?
        token_record.revoke!
        store_csrf_cookie

        user = User.find(token_record.user_id)
        scheme = resolve_scheme
        return json_error("Unable to determine organization", :unprocessable_entity, code: "tenant_unresolved") unless scheme.present?

        new_access_token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

        effective_role = Membership.effective_role(user_id: user.id, scheme: scheme, fallback_role: user.role)
        json_response({ access_token: new_access_token, user: { id: user.id, email: user.email, role: effective_role }, refresh: true })
      end

      # DELETE /api/v1/auth/logout
      def logout
        verify_csrf!
        refresh_token_value = extract_refresh_token
        if refresh_token_value
          token_record = RefreshToken.find_by(token_hash: token_hash(refresh_token_value))
          token_record&.revoke!
        end
        clear_refresh_cookie
        json_response({ message: "Logged out successfully" })
      end
    end
  end
end
