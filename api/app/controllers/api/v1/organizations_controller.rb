# frozen_string_literal: true

module Api
  module V1
    class OrganizationsController < ApiController
      authorize_auth_token! :assessor

      # GET /api/v1/organization/ai_config
      def show_ai_config
        org = current_organization_record
        json_response(ai_config: ai_config_json(org))
      end

      # PATCH /api/v1/organization/ai_config
      def update_ai_config
        org = current_organization_record
        models_param = params[:models]
        models_hash = models_param.respond_to?(:to_unsafe_h) ? models_param.to_unsafe_h : models_param

        org.update_ai_config!(
          gemini_api_key: params[:gemini_api_key],
          models: models_hash,
          voice: params[:voice],
          temperature: params[:temperature]
        )

        json_response(ai_config: ai_config_json(org))
      rescue ActiveRecord::RecordInvalid => e
        json_error(e.record.errors.full_messages.first, :unprocessable_entity)
      end

      private

      def current_organization_record
        Current.organization || current_organization || Organization.default_organization
      end

      def ai_config_json(org)
        {
          custom_ai_configured: org.custom_ai_configured?,
          gemini_api_key_configured: org.ai_config['gemini_api_key'].present?,
          masked_gemini_api_key: org.masked_gemini_api_key,
          models: {
            live: org.gemini_model(:live),
            flash: org.gemini_model(:flash),
            pro: org.gemini_model(:pro)
          },
          voice: org.gemini_voice,
          temperature: org.gemini_temperature,
          allowed_voices: Organization::ALLOWED_GEMINI_VOICES
        }
      end
    end
  end
end
