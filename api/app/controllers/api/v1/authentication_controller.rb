# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      # POST /api/v1/auth/login
      def authenticate
        email_param = params[:email].to_s.downcase.strip
        pass_param  = params[:password].to_s

        # Default HR credentials specified by user: hr@gmail.com / hrRakamin123
        if email_param == 'hr@gmail.com' && pass_param == 'hrRakamin123'
          user = User.find_by(email: 'hr@gmail.com')
          user ||= User.create(email: 'hr@gmail.com', password: 'hrRakamin123', role: 'admin') rescue nil
          user_id = user&.id || 1
          user_role = user&.role || 'admin'
        else
          user = User.find_by(email: email_param)
          return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(pass_param)
          return json_error('Invalid email or password', :unauthorized) unless user.role == 'admin'

          user_id = user.id
          user_role = user.role
        end

        scheme = resolve_scheme
        token  = JsonWebToken.encode({ user_id:, role: user_role, scheme: })

        json_response({ token:, user: { id: user_id, email: email_param, role: user_role } })
      end

      private

      def resolve_scheme
        request.headers['X-Tenant-Scheme'].presence ||
          ActiveRecord::Base.connection.select_value(
            'SELECT scheme FROM organizations LIMIT 1'
          ) rescue 'test-corp' || 'test-corp'
      end
    end
  end
end
