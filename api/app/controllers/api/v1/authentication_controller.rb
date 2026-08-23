# frozen_string_literal: true

module Api
    module V1
        class AuthenticationController < ApiController
            skip_before_action :require_tenant!

            # POST /api/v1/auth/login
            def authenticate
                user = User.find_by(email: params[:email].to_s.downcase)

                unless user&.authenticate(params[:password])
                    return json_error('Invalid email or password', :unauthorized)
                end

                return json_error('Invalid email or password', :unauthorized) unless user.role == 'admin'

                scheme = user.organization.scheme

                token = JsonWebToken.encode(
                    user_id: user.id,
                    role: user.role,
                    scheme:
                )

                json_response({
                                  token:,
                                  user: {
                                      id: user.id,
                                      email: user.email,
                                      role: user.role
                                  },
                                  tenant: user.organization.name
                              })
            end


        end
    end
end
