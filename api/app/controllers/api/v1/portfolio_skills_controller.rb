# frozen_string_literal: true

module Api
  module V1
    class PortfolioSkillsController < ApiController
      authorize_auth_token! :assessor

      before_action :set_portfolio_skill

      # POST /api/v1/portfolio-skills/:id/override
      # Validasi, penyimpanan state, dan pencatatan riwayat ada di Overrides::Apply
      # agar controller tetap tipis dan semuanya terjadi dalam satu transaksi.
      def override
        result = Overrides::Apply.new(
          portfolio_skill: @portfolio_skill,
          level:           override_params[:override_level],
          reason:          override_params[:assessor_notes],
          actor_id:        current_user.id
        ).call

        return json_error(result.error, result.status) unless result.success?

        regenerate_stale_fitgap_reports
        json_response(
          { override: override_json(result.override), event: OverrideEventSerializer.call(result.event) },
          result.created ? :created : :ok
        )
      end

      private

      # F-09: laporan tidak dihapus; ditandai stale dan diperbarui di latar belakang.
      # Worker idempoten, jadi override beruntun tidak menghasilkan kerja ganda.
      def regenerate_stale_fitgap_reports
        FitGapReport.where(portfolio_id: @portfolio_skill.portfolio_id).find_each do |report|
          report.request_regeneration!(force: true)
        end
      end

      def set_portfolio_skill
        # Hanya skill milik organisasi yang aktif; selain itu 404 (F-02).
        @portfolio_skill = PortfolioSkill.for_tenant(current_tenant_id).find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Portfolio skill not found", :not_found)
      end

      def override_params
        params.require(:override).permit(:override_level, :assessor_notes)
      end

      def override_json(override)
        {
          id:                 override.id,
          portfolio_skill_id: override.portfolio_skill_id,
          ai_level:           override.ai_level,
          override_level:     override.override_level,
          assessor_notes:     override.assessor_notes,
          overridden_by:      override.overridden_by,
          overridden_at:      override.overridden_at
        }
      end
    end
  end
end
