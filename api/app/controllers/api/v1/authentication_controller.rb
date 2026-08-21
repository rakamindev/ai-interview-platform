# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      # POST /api/v1/auth/login
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error("Invalid email or password", :unauthorized) unless user&.authenticate(params[:password])

        return json_error("Invalid email or password", :unauthorized) unless user.role == "admin"

        scheme = resolve_scheme
        token  = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

        refresh_token = SecureRandom.hex(32)
        RefreshToken.create!(
          user_id: user.id,
          token_hash: token_hash(refresh_token),
          expires_at: 7.days.from_now
        )
        store_refresh_cookie(refresh_token)
        store_csrf_cookie

        json_response({ access_token: token, user: { id: user.id, email: user.email, role: user.role }, refresh: true })
      end

      # POST /api/v1/auth/refresh
      def refresh
        verify_csrf!
        refresh_token_value = extract_refresh_token
        return json_error("Missing refresh token", :unauthorized, details: "missing_refresh_token") unless refresh_token_value

        token_record = RefreshToken.find_by(token_hash: token_hash(refresh_token_value))
        return json_error("Invalid refresh token", :unauthorized, details: "invalid_refresh_token") unless token_record&.valid_token?

        if token_record.used_at.present? && token_record.grace_period_expired?
          # Same rotated-away token replayed after the grace window: treat as theft, kill the whole session family.
          RefreshToken.revoke_all_for_user(token_record.user_id)
          return json_error("Refresh token reuse detected", :unauthorized, details: "refresh_token_reused")
        end

        new_token = issue_refresh_token(token_record.user_id)
        store_refresh_cookie(new_token)
        token_record.mark_used! if token_record.used_at.nil?
        token_record.revoke!
        store_csrf_cookie

        user = User.find(token_record.user_id)
        scheme = resolve_scheme
        new_access_token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

        json_response({ access_token: new_access_token, user: { id: user.id, email: user.email, role: user.role }, refresh: true })
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

      private

      def store_refresh_cookie(token)
        cookies[:refresh_token] = {
          value: token,
          path: "/api/v1/auth",
          max_age: 604_800,
          same_site: :lax,
          httponly: true,
          secure: Rails.env.production?
        }
      end

      def clear_refresh_cookie
        cookies.delete(:refresh_token, path: "/api/v1/auth")
      end

      def extract_refresh_token
        cookies[:refresh_token]
      end

      def store_csrf_cookie
        secret = SecureRandom.hex(32)
        cookies[:csrf_secret] = {
          value: secret,
          expires: 7.days.from_now,
          secure: Rails.env.production?,
          same_site: :lax,
          httponly: false
        }
        @csrf_secret = secret
      end

      def verify_csrf!
        expected = cookies[:csrf_secret]
        actual = request.headers["X-CSRF-Token"]
        return if expected.present? && actual.present? && ActiveSupport::SecurityUtils.secure_compare(expected, actual)

        raise(ExceptionHandler::InvalidToken, "CSRF token mismatch")
      end

      def token_hash(token)
        RefreshToken.hash_token(token)
      end

      def issue_refresh_token(user_id)
        new_token = SecureRandom.hex(32)
        RefreshToken.create!(
          user_id: user_id,
          token_hash: token_hash(new_token),
          expires_at: 7.days.from_now
        )
        new_token
      end

      def resolve_scheme
        scheme_from_referer || Organization.order(:created_at).limit(1).pick(:scheme) || "test-corp"
      end

      def scheme_from_referer
        referer = request.referer.to_s
        return if referer.blank?

        host = URI.parse(referer).host.to_s
        return if host.blank?

        Organization.find_by(host: host)&.scheme
      rescue URI::InvalidURIError
        nil
      end
    end
  end
end
