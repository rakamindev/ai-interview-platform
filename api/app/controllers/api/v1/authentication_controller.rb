# frozen_string_literal: true

module Api
  module V1
    class AuthenticationController < ApiController
      skip_before_action :require_tenant!

      # POST /api/v1/auth/login
      def authenticate
        user = User.find_by(email: params[:email].to_s.downcase.strip)

        return json_error('Invalid email or password', :unauthorized) unless user&.authenticate(params[:password])

        # Load all memberships and associated organizations
        memberships = user.organization_memberships.includes(:organization)

        # Active organization selection
        active_org = if params[:organization_id].present?
                       user.organizations.find_by(id: params[:organization_id])
                     else
                       memberships.first&.organization
                     end

        active_membership = active_org ? user.organization_memberships.find_by(organization_id: active_org.id) : nil
        active_role = active_membership&.role || user.role
        active_scheme = active_org&.scheme

        token = JsonWebToken.encode({ user_id: user.id, role: active_role, scheme: active_scheme })

        orgs_payload = memberships.map do |m|
          {
            id:     m.organization.id,
            name:   m.organization.name,
            scheme: m.organization.scheme,
            role:   m.role
          }
        end

        json_response({
          token: token,
          user: { id: user.id, email: user.email, role: active_role },
          active_organization: active_org && {
            id:     active_org.id,
            name:   active_org.name,
            scheme: active_org.scheme
          },
          organizations: orgs_payload
        })
      end

      # POST /api/v1/auth/signup/organization
      def signup_organization
        org_name = params[:organization_name].to_s.strip
        email    = params[:email].to_s.downcase.strip
        password = params[:password]

        return json_error('Organization name, email, and password are required', :unprocessable_entity) if org_name.blank? || email.blank? || password.blank?

        if User.exists?(email: email)
          return json_error('Email has already been taken', :unprocessable_entity)
        end

        # Generate unique URL-safe scheme / slug
        base_slug = org_name.to_s.downcase.gsub(/[^a-z0-9]+/, '-').gsub(/\A-+|-+\z/, '').presence || 'org'
        scheme = base_slug
        counter = 1
        while ::Organization.exists?(scheme: scheme)
          scheme = "#{base_slug}-#{counter}"
          counter += 1
        end

        org = nil
        user = nil
        token = nil

        ActiveRecord::Base.transaction do
          org = ::Organization.create!(
            name:        org_name,
            scheme:      scheme,
            identifier:  scheme,
            host:        'localhost',
            alias_hosts: [],
            config:      {}
          )

          user = ::User.create!(
            email:    email,
            password: password,
            role:     'admin'
          )

          ::OrganizationMembership.create!(
            user:         user,
            organization: org,
            role:         'admin'
          )

          token = JsonWebToken.encode({ user_id: user.id, role: 'admin', scheme: org.scheme })
        end

        json_response({
          token: token,
          user: { id: user.id, email: user.email, role: 'admin' },
          active_organization: { id: org.id, name: org.name, scheme: org.scheme },
          organizations: [
            { id: org.id, name: org.name, scheme: org.scheme, role: 'admin' }
          ]
        }, :created)
      rescue ActiveRecord::RecordInvalid => e
        json_error(e.record.errors.full_messages.join(', '), :unprocessable_entity)
      rescue StandardError => e
        Rails.logger.error("[SignupOrganization Error] #{e.class}: #{e.message}\n#{e.backtrace&.first(15)&.join("\n")}")
        json_error('Gagal mendaftarkan organisasi. Silakan periksa kembali data Anda.', :unprocessable_entity)
      end

      # POST /api/v1/auth/signup/user
      def signup_user
        email    = params[:email].to_s.downcase.strip
        password = params[:password]
        role     = params[:role].presence || 'user'

        return json_error('Email and password are required', :unprocessable_entity) if email.blank? || password.blank?

        if User.exists?(email: email)
          return json_error('Email has already been taken', :unprocessable_entity)
        end

        user = User.new(email: email, password: password, role: role)
        if user.save
          token = JsonWebToken.encode({ user_id: user.id, role: user.role, scheme: nil })
          json_response({
            token: token,
            user: { id: user.id, email: user.email, role: user.role },
            active_organization: nil,
            organizations: []
          }, :created)
        else
          json_error(user.errors.full_messages.join(', '), :unprocessable_entity)
        end
      end

      # Legacy / unified signup router for backward compatibility
      def signup
        if params[:organization_name].present?
          signup_organization
        else
          signup_user
        end
      end

      # POST /api/v1/auth/switch_tenant
      def switch_tenant
        token = extract_bearer_token
        return json_error('Missing authentication token', :unauthorized) if token.blank?

        claims = JsonWebToken.decode(token)
        user = User.find_by(id: claims[:user_id])
        return json_error('User not found', :not_found) unless user

        target_org_id = params[:organization_id]
        membership = user.organization_memberships.find_by(organization_id: target_org_id)
        return json_error('You are not a member of this organization', :forbidden) unless membership

        target_org = membership.organization
        new_token = JsonWebToken.encode({
          user_id: user.id,
          role:    membership.role,
          scheme:  target_org.scheme
        })

        json_response({
          token: new_token,
          active_organization: {
            id:     target_org.id,
            name:   target_org.name,
            scheme: target_org.scheme
          },
          role: membership.role
        })
      rescue ExceptionHandler::InvalidToken, ExceptionHandler::MissingToken => e
        json_error(e.message, :unauthorized)
      end

      private

      def extract_bearer_token
        header = request.headers['Authorization'].to_s
        header.split(' ').last if header.start_with?('Bearer ', 'bearer ')
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
