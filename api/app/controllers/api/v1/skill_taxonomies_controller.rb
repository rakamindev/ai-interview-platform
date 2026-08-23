# frozen_string_literal: true

module Api
    module V1
        class SkillTaxonomiesController < ApiController
            authorize_auth_token! :assessor

            before_action :set_skill, only: %i[show]

            # GET /api/v1/skill_taxonomies
            def index
                full = params[:full].present?

                cache_key = [
                    Current.tenant_id,
                    SkillTaxonomy.model_name.cache_key,
                    'index',
                    params.to_unsafe_h.sort.to_h,
                    SkillTaxonomy.cache_version
                ]

                skill_taxonomies = Rails.cache.fetch(cache_key, expires_in: 1.day) do
                    skills = SkillTaxonomy.order(:skill_id)
                    skills = skills.where(category: params[:category]) if params[:category].present?

                    skills.map do |skill|
                        if full
                            ::Api::V1::SkillTaxonomySerializer.detail(skill)
                        else
                            ::Api::V1::SkillTaxonomySerializer.list(skill)
                        end
                    end
                end

                json_response(skill_taxonomies: skill_taxonomies)
            end

            # GET /api/v1/skill_taxonomies/:skill_id
            def show
                cache_key = [
                    Current.tenant_id,
                    SkillTaxonomy.model_name.cache_key,
                    'show',
                    params[:skill_id],
                    SkillTaxonomy.cache_version
                ]

                result = Rails.cache.fetch(cache_key, expires_in: 1.day) do
                    ::Api::V1::SkillTaxonomySerializer.detail(@skill)
                end


                json_response(skill: result)
            rescue ActiveRecord::RecordNotFound
                json_error('Skill not found', :not_found)
            end

            private

            def set_skill
                cache_key = [
                    Current.tenant_id,
                    SkillTaxonomy.model_name.cache_key,
                    params[:id],
                    SkillTaxonomy.cache_version
                ]

                @skill = Rails.cache.fetch(cache_key, expires_in: 1.day) do
                    SkillTaxonomy.find_by!(skill_id:  params[:skill_id])
                end

            rescue ActiveRecord::RecordNotFound
                json_error('Skill not found', :not_found)
            end


        end
    end
end