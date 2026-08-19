# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!, except: [:me]
      authorize_auth_token! :any, only: [:me]

      # GET /api/v1/auth/me
      def me
        json_response({ user: { id: current_user.id, email: current_user.email, role: current_user.role } })
      end

      # POST /api/v1/auth/login
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase)

        return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(params[:password])

        return json_error('Invalid email or password', :unauthorized) unless user.role == 'admin'

        scheme = resolve_scheme
        token  = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })

        json_response({ token:, user: { id: user.id, email: user.email, role: user.role } })
      end

      # POST /api/v1/auth/register
      def register
        user = User.new(
          email: params[:email].to_s.downcase,
          password: params[:password],
          role: 'admin' # Default role for new signups in this assessment
        )

        if user.save
          scheme = resolve_scheme
          token  = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: })
          json_response({ token:, user: { id: user.id, email: user.email, role: user.role } })
        else
          json_error(user.errors.full_messages.join(', '), :unprocessable_entity)
        end
      end

      # POST /api/v1/auth/forgot_password
      def forgot_password
        user = User.find_by(email: params[:email].to_s.downcase)
        if user
          user.generate_password_reset_token!
          json_response({ message: 'Instruksi reset password telah dikirim ke email Anda' })
        else
          # Tetap tampil sukses untuk mencegah email enumeration attack
          json_response({ message: 'Instruksi reset password telah dikirim ke email Anda' })
        end
      end

      # POST /api/v1/auth/reset_password
      def reset_password
        user = User.find_by(reset_password_token: params[:token].to_s)

        if user&.password_reset_valid?
          if user.update(password: params[:password], reset_password_token: nil, reset_password_sent_at: nil)
            json_response({ message: 'Password berhasil diubah. Silakan login kembali.' })
          else
            json_error(user.errors.full_messages.join(', '), :unprocessable_entity)
          end
        else
          json_error('Token reset password tidak valid atau sudah kedaluwarsa', :unauthorized)
        end
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
