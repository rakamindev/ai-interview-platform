# frozen_string_literal: true

require 'net/http'
require 'uri'
require 'json'
require 'securerandom'

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      # POST /api/v1/auth/login
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(params[:password])

        return json_error('Invalid email or password', :unauthorized) unless user.role == 'admin'

        scheme = resolve_scheme
        token  = JsonWebToken.encode({ user_id: user.id, email: user.email, role: user.role, scheme: })

        json_response({ token:, user: { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url, role: user.role } })
      end

      # GET /api/v1/auth/me
      def me
        auth_header = request.headers['Authorization']
        return json_error('Missing authorization token', :unauthorized) unless auth_header.present?

        payload = AuthorizeApiRequest.new(request.headers, %w[admin user assessor]).call
        user = User.find_by(id: payload[:user].id)
        return json_error('User not found', :not_found) unless user

        json_response({ user: { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url, role: user.role } })
      end

      # POST /api/v1/auth/google
      def authenticate_google
        id_token = params[:credential].presence || params[:id_token].presence
        email = nil

        if id_token.present?
          email = verify_google_id_token(id_token)
          return json_error('Invalid or expired Google Token', :unauthorized) unless email
        elsif Rails.env.development? || Rails.env.test?
          # In test/dev environment, allow instant demo/mock Google authentication
          email = params[:email].presence || 'admin@rakamin.com'
        else
          return json_error('Missing Google credential', :bad_request)
        end

        email = email.to_s.downcase.strip
        user = User.find_by(email:)

        name = params[:name].presence
        avatar_url = params[:avatar_url].presence

        # Auto-provision admin for any authenticated Google account (allow all domains including @gmail.com)
        if user.nil?
          user = User.create!(
            email:,
            name:,
            avatar_url:,
            password: SecureRandom.hex(16),
            role: 'admin'
          )
        else
          updates = {}
          updates[:name] = name if name.present?
          updates[:avatar_url] = avatar_url if avatar_url.present?
          user.update!(updates) if updates.any?
        end

        return json_error('Unauthorized assessor account.', :unauthorized) unless user&.role == 'admin'

        scheme = resolve_scheme
        token  = JsonWebToken.encode({ user_id: user.id, email: user.email, role: user.role, scheme: })

        json_response({ token:, user: { id: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url, role: user.role }, provider: 'google' })
      end

      private

      def verify_google_id_token(token)
        # Google GIS initTokenClient returns an access_token (ya29...), while OneTap/Credential returns a JWT id_token
        param_name = token.to_s.count('.') == 2 ? 'id_token' : 'access_token'
        uri = URI("https://oauth2.googleapis.com/tokeninfo?#{param_name}=#{token}")
        response = Net::HTTP.get_response(uri)
        return nil unless response.is_a?(Net::HTTPSuccess)

        data = JSON.parse(response.body)
        client_id = ENV['GOOGLE_CLIENT_ID']
        return nil if client_id.present? && (data['aud'] != client_id && data['azp'] != client_id)

        data['email']
      rescue StandardError => e
        Rails.logger.warn("[Auth] Google token verification error: #{e.message}")
        nil
      end

      def resolve_scheme
        request.headers['X-Tenant-Scheme'].presence ||
          ActiveRecord::Base.connection.select_value(
            'SELECT scheme FROM organizations LIMIT 1'
          ) || 'test-corp'
      end
    end
  end
end
