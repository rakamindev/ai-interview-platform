# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      # POST /api/v1/auth/login
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(params[:password])

        return json_error('Access restricted to portal users', :forbidden) unless user.portal_access?

        scheme = resolve_scheme
        org    = Organization.find_by(scheme: scheme)
        token  = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

        json_response({
          token: token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role
          },
          organization: org ? { id: org.id, name: org.name, scheme: org.scheme } : { id: 1, name: 'Default Org', scheme: scheme }
        })
      end

      # POST /api/v1/auth/signup
      def signup
        email    = params[:email].to_s.downcase.strip
        password = params[:password].to_s
        role     = params[:role].to_s.strip

        # Default to 'assessor' if not specified or if 'user' is requested
        role = 'assessor' if role.blank? || role == 'user'
        unless User::ROLES.include?(role)
          return json_error("Invalid role. Permitted: #{User::SIGNUP_ROLES.join(', ')}", :unprocessable_entity)
        end

        if User.exists?(email: email)
          return json_error('Email has already been taken', :unprocessable_entity)
        end

        user = User.new(email: email, password: password, role: role)

        if user.save
          scheme = resolve_scheme
          org    = Organization.find_by(scheme: scheme)
          token  = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

          json_response({
            token: token,
            user: {
              id: user.id,
              email: user.email,
              role: user.role
            },
            organization: org ? { id: org.id, name: org.name, scheme: org.scheme } : { id: 1, name: 'Default Org', scheme: scheme }
          }, :created)
        else
          json_error(user.errors.full_messages.first, :unprocessable_entity)
        end
      end

      # GET /api/v1/auth/me
      def me
        auth_header = request.headers['Authorization'].to_s
        return json_error('Missing auth token', :unauthorized) if auth_header.blank?

        token = auth_header.split(' ').last
        decoded = JsonWebToken.decode(token)
        user = User.find_by(id: decoded[:user_id])

        return json_error('User not found', :not_found) unless user

        scheme = decoded[:scheme].presence || resolve_scheme
        org = Organization.find_by(scheme: scheme)

        json_response({
          user: {
            id: user.id,
            email: user.email,
            role: user.role
          },
          organization: org ? { id: org.id, name: org.name, scheme: org.scheme } : { id: 1, name: 'Default Org', scheme: scheme }
        })
      rescue ExceptionHandler::InvalidToken => e
        json_error(e.message, :unauthorized)
      rescue StandardError => e
        json_error(e.message, :unauthorized)
      end

      private

      def resolve_scheme
        request.headers['X-Tenant-Scheme'].presence ||
          ActiveRecord::Base.connection.select_value(
            'SELECT scheme FROM organizations LIMIT 1'
          ) || 'test-corp'
      end
    end
  end
end
