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
        set_refresh_cookie(refresh_token)

        json_response({ access_token: token, user: { id: user.id, email: user.email, role: user.role } })
      end

      # POST /api/v1/auth/refresh
      def refresh
        verify_csrf!
        refresh_token_value = extract_refresh_token
        return json_error("Missing refresh token", :unauthorized) unless refresh_token_value

        token_record = RefreshToken.find_by_token_hash(token_hash(refresh_token_value))
        return json_error("Invalid refresh token", :unauthorized) unless token_record&.valid_token?

        if token_record.grace_period_expired?
          token_record.revoke!
          new_token = issue_refresh_token(token_record.user_id)
          set_refresh_cookie(new_token)
        else
          new_token = issue_refresh_token(token_record.user_id)
          set_refresh_cookie(new_token)
          token_record.mark_used! if token_record.used_at.nil?
        end

        user = User.find(token_record.user_id)
        scheme = resolve_scheme
        access_token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

        json_response({ access_token:, user: { id: user.id, email: user.email, role: user.role } })
      end

      # DELETE /api/v1/auth/logout
      def logout
        refresh_token_value = extract_refresh_token
        if refresh_token_value
          token_record = RefreshToken.find_by_token_hash(token_hash(refresh_token_value))
          token_record&.revoke!
        end
        clear_refresh_cookie
        json_response({ message: "Logged out successfully" })
      end

      private

      def set_refresh_cookie(token)
        cookies[:refresh_token] = {
          value: token,
          http_only: true,
          secure: Rails.env.production?,
          same_site: :lax,
          path: "/api/v1/auth",
          max_age: 604800
        }
      end

      def clear_refresh_cookie
        cookies.delete(:refresh_token, path: "/api/v1/auth")
      end

      def extract_refresh_token
        cookies[:refresh_token]
      end

      def verify_csrf!
        unless request.headers["X-Requested-With"].present?
          render json: { errors: [{ status: 403, message: "Missing CSRF token" }] }, status: :forbidden
        end
      end

      def token_hash(token)
        Digest::SHA256.hexdigest(token)
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
        scheme_from_referer ||
          ActiveRecord::Base.connection.select_value(
            "SELECT scheme FROM organizations LIMIT 1"
          ) || "test-corp"
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
