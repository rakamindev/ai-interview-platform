# frozen_string_literal: true

module Api
  module V1
    # Admin-only user management. Registration is invite-based (admin creates
    # accounts) — there is no public signup endpoint.
    class UsersController < ApiController
      authorize_auth_token! :admin

      # GET /api/v1/users
      def index
        scope = User
        scope = scope.where('email ILIKE ?', "%#{sanitize_like(query_params[:q])}%") if query_params[:q].present?
        scope = scope.where(role: query_params[:role]) if query_params[:role].present?
        scope = scope.order(sort_clause)

        users = paginate(scope)

        json_response(
          users: users.map(&method(:user_json)),
          meta: pagination_meta(users)
        )
      end

      # POST /api/v1/users
      def create
        user = User.new(user_params)

        if user.save
          json_response({ user: user_json(user), message: 'User created' }, :created)
        else
          json_error(user.errors.full_messages.first, :unprocessable_entity)
        end
      end

      private

      def user_params
        params.require(:user).permit(:email, :password, :role)
      end

      def user_json(user)
        {
          id:         user.id,
          email:      user.email,
          role:       user.role,
          created_at: user.created_at
        }
      end

      def sort_clause
        case query_params[:sort]
        when 'oldest' then { created_at: :asc }
        when 'name'   then 'email ASC'
        else              { created_at: :desc }
        end
      end

      def pagination_meta(collection)
        {
          current_page: collection.current_page,
          total_pages:  collection.total_pages,
          total_count:  collection.total_count,
          per_page:     collection.limit_value
        }
      end

      def sanitize_like(value)
        value.to_s.gsub(/[%_\\]/) { |m| "\\#{m}" }
      end
    end
  end
end
