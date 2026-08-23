# frozen_string_literal: true

module Api
  module V1
    class SkillTaxonomiesController < ApiController
      authorize_auth_token! :assessor

      # GET /api/v1/skill_taxonomies
      #
      # Read-only reference data: cached at two levels.
      #   1. Rails.cache, keyed by data generation (SkillTaxonomy.cache_version)
      #      — any taxonomy write orphans all cached lists at once.
      #   2. Cache-Control header — safe because this is non-sensitive,
      #     tenant-independent reference data.
      def index
        skills = Rails.cache.fetch(index_cache_key, expires_in: 1.hour) do
          scope = SkillTaxonomy.order(:skill_id)
          scope = scope.where(category: params[:category]) if params[:category].present?
          serialize(scope, with: SkillTaxonomySerializer)
        end

        response.set_header('Cache-Control', 'public, max-age=300')
        json_response(skill_taxonomies: skills)
      end

      # GET /api/v1/skill_taxonomies/:skill_id
      def show
        skill = SkillTaxonomy.find_by!(skill_id: params[:skill_id])
        json_response(skill: SkillTaxonomySerializer.new(skill).as_json)
      rescue ActiveRecord::RecordNotFound
        json_error("Skill not found", :not_found)
      end

      private

      def index_cache_key
        category = params[:category].presence || 'all'
        "skill_taxonomies:v#{SkillTaxonomy.cache_version}:#{category}"
      end
    end
  end
end
