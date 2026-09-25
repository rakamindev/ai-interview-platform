# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      # POST /api/v1/auth/login
      def authenticate
        user = User.includes(:organization).find_by(email: params[:email].to_s.downcase)

        return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(params[:password])
        return json_error('This account is not connected to an organization', :unprocessable_entity) unless user.organization
        return json_error('Invalid email or password', :unauthorized) unless user.role == 'admin'

        render_session(user)
      end

      # POST /api/v1/auth/register
      # Self-service onboarding creates an organization and its first admin.
      # Role is intentionally NOT accepted from the client to prevent privilege escalation.
      def register
        organization_name = params[:organization_name].to_s.strip
        email = params[:email].to_s.downcase.strip
        password = params[:password].to_s

        return json_error('Organization name is required', :unprocessable_entity) if organization_name.blank?
        return json_error('Password must be at least 8 characters', :unprocessable_entity) if password.length < 8

        user = nil

        ActiveRecord::Base.transaction do
          scheme = unique_scheme_for(organization_name)
          organization = Organization.create!(
            name: organization_name,
            scheme: scheme,
            identifier: scheme,
            host: "#{scheme}.local",
            alias_hosts: [],
            config: {}
          )

          user = User.create!(
            email: email,
            password: password,
            password_confirmation: password,
            role: 'admin',
            organization: organization
          )
        end

        render_session(user, status: :created)
      rescue ActiveRecord::RecordInvalid => e
        json_error(e.record.errors.full_messages.first, :unprocessable_entity)
      end

      # POST /api/v1/auth/forgot_password
      # Always returns 200 so callers cannot enumerate registered email addresses.
      def forgot_password
        user = User.find_by(email: params[:email].to_s.downcase.strip)
        token = PasswordResetToken.generate(user) if user

        payload = {
          message: 'If an account exists for that email, password reset instructions have been prepared.'
        }

        # This take-home app has no email provider. In development/test only,
        # return a one-time signed token so the reset flow can be exercised end-to-end.
        payload[:dev_reset_token] = token if token && !Rails.env.production?

        json_response(payload)
      end

      # POST /api/v1/auth/reset_password
      def reset_password
        password = params[:password].to_s
        password_confirmation = params[:password_confirmation].presence || password

        return json_error('Password must be at least 8 characters', :unprocessable_entity) if password.length < 8
        return json_error('Password confirmation does not match', :unprocessable_entity) unless password == password_confirmation

        user = PasswordResetToken.verify(params[:token])
        return json_error('Reset link is invalid or expired', :unprocessable_entity) unless user

        user.update!(password: password, password_confirmation: password_confirmation)
        json_response(message: 'Password has been reset successfully.')
      rescue ActiveRecord::RecordInvalid => e
        json_error(e.record.errors.full_messages.first, :unprocessable_entity)
      end

      private

      def render_session(user, status: :ok)
        organization = user.organization
        token = JsonWebToken.encode(
          user_id: user.id,
          role: user.role,
          scheme: organization.scheme
        )

        json_response(
          {
            token: token,
            user: { id: user.id, email: user.email, role: user.role },
            organization: {
              id: organization.id,
              name: organization.name,
              scheme: organization.scheme
            }
          },
          status
        )
      end

      def unique_scheme_for(name)
        base = name.parameterize.presence || 'organization'
        candidate = base
        suffix = 1

        while Organization.exists?(scheme: candidate)
          suffix += 1
          candidate = "#{base}-#{suffix}"
        end

        candidate
      end
    end
  end
end
