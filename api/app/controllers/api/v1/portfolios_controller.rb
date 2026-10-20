# frozen_string_literal: true

module Api
  module V1
    class PortfoliosController < ApiController
      authorize_auth_token! :assessor

      before_action :set_session,   only: %i[show regenerate]
      before_action :set_portfolio, only: %i[show export]

      # GET /api/v1/sessions/:id/portfolio
      def show
        if @portfolio.nil? || @portfolio.generating? || @portfolio.generation_status == 'pending'
          return render json: {
            status:          'generating',
            session_summary: build_session_summary(@session, [], build_unassessed_skills(@session, []))
          }, status: :accepted
        end

        if @portfolio.failed?
          sanitized = sanitize_generation_error(@portfolio.generation_error)
          return json_response(
            portfolio:  portfolio_json(@portfolio),
            error:      sanitized[:message],
            error_code: sanitized[:code]
          )
        end

        json_response(portfolio: portfolio_json(@portfolio))
      end

      # POST /api/v1/sessions/:id/portfolio/regenerate
      def regenerate
        portfolio = @session.portfolio

        if portfolio.nil?
          return json_error('No portfolio found for this session', :not_found)
        end

        force = ActiveModel::Type::Boolean.new.cast(params[:force])
        unless portfolio.failed? || force
          return json_error("Portfolio can only be regenerated when status is 'failed'", :unprocessable_entity)
        end

        portfolio.update!(generation_status: 'pending', generation_error: nil)
        PortfolioGeneratorWorker.perform_async(@session.id)

        json_response(
          message:   'Portfolio generation queued',
          portfolio: portfolio_json(portfolio)
        )
      end

      # GET /api/v1/portfolios/:id/export
      def export
        format = params.fetch(:format, 'json')

        unless %w[pdf json].include?(format)
          return json_error("Format must be 'pdf' or 'json'", :unprocessable_entity)
        end

        unless @portfolio.complete?
          return json_error("Portfolio is not ready for export (status: #{@portfolio.generation_status})", :unprocessable_entity)
        end

        vacancy = nil
        if params[:vacancy_id].present?
          vacancy = find_tenant_vacancy(params[:vacancy_id])
          return json_error('Vacancy not found', :not_found) unless vacancy
        end

        if format == 'pdf'
          pdf_data = Exports::PdfGenerator.new(portfolio: @portfolio, vacancy: vacancy).call

          return send_data pdf_data,
                           filename:    "portfolio-#{@portfolio.id}.pdf",
                           type:        'application/pdf',
                           disposition: 'attachment'
        end

        export_data = build_export_json(@portfolio, vacancy)

        send_data export_data.to_json,
                  filename:    "portfolio-#{@portfolio.id}.json",
                  type:        'application/json',
                  disposition: 'attachment'
      end

      # POST /api/v1/portfolios/:id/regenerate_fitgap
      def regenerate_fitgap
        portfolio  = find_tenant_portfolio!(params[:id])
        vacancy_id = params.dig(:fitgap, :vacancy_id) || params[:vacancy_id]

        return json_error('vacancy_id is required', :unprocessable_entity) if vacancy_id.blank?

        vacancy = find_tenant_vacancy(vacancy_id)
        return json_error('Vacancy not found', :not_found) unless vacancy

        unless portfolio.complete?
          return json_error("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

        FitGap::GenerationTracker.force_regenerate(portfolio.id, vacancy.id)

        render json: { status: 'generating', message: 'Fit/gap report regeneration queued' }, status: :accepted
      rescue ActiveRecord::RecordNotFound
        json_error('Portfolio not found', :not_found)
      end

      # POST /api/v1/portfolios/:id/fitgap
      def fitgap
        portfolio  = find_tenant_portfolio!(params[:id])
        vacancy_id = params.dig(:fitgap, :vacancy_id) || params[:vacancy_id]

        return json_error('vacancy_id is required', :unprocessable_entity) if vacancy_id.blank?

        vacancy = find_tenant_vacancy(vacancy_id)
        return json_error('Vacancy not found', :not_found) unless vacancy

        unless portfolio.complete?
          return json_error("Portfolio is not ready (status: #{portfolio.generation_status})", :unprocessable_entity)
        end

        existing = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
        if existing && !FitGap::GenerationTracker.report_stale?(portfolio, existing)
          return json_response(status: 'ready', report: fit_gap_json(existing, portfolio: portfolio))
        end

        existing&.destroy
        FitGap::GenerationTracker.try_lock_and_enqueue(portfolio.id, vacancy.id)

        render json: { status: 'generating', message: 'Fit/gap report generation queued' }, status: :accepted
      rescue ActiveRecord::RecordNotFound
        json_error('Portfolio not found', :not_found)
      end

      # GET /api/v1/portfolios/:id/fitgap/:vacancy_id
      def show_fitgap
        portfolio = find_tenant_portfolio!(params[:id])
        vacancy   = find_tenant_vacancy(params[:vacancy_id])
        return json_error('Vacancy not found', :not_found) unless vacancy

        report = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)

        if report.present?
          if FitGap::GenerationTracker.report_stale?(portfolio, report)
            FitGap::GenerationTracker.try_lock_and_enqueue(portfolio.id, vacancy.id)
            return render json: { status: 'generating', stale: true, report: nil }, status: :accepted
          end

          return json_response(status: 'ready', report: fit_gap_json(report, portfolio: portfolio))
        end

        tracker_state = FitGap::GenerationTracker.current_state(portfolio.id, vacancy.id)
        case tracker_state&.dig('status')
        when 'generating'
          render json: { status: 'generating', report: nil }, status: :accepted
        when 'failed'
          json_response(
            status:     'failed',
            error_code: tracker_state['error_code'] || 'generation_failed',
            message:    tracker_state['message'] || 'Unable to generate fit/gap report. Please try again.',
            report:     nil
          )
        else
          json_response(status: 'not_generated', report: nil)
        end
      rescue ActiveRecord::RecordNotFound
        json_error('Portfolio not found', :not_found)
      end

      private

      def set_session
        @session = Session.where(tenant_id: current_tenant_id).find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error('Session not found', :not_found)
      end

      def set_portfolio
        @portfolio = if @session
                       @session.portfolio
                     else
                       find_tenant_portfolio!(params[:id])
                     end
      rescue ActiveRecord::RecordNotFound
        json_error('Portfolio not found', :not_found)
      end

      def find_tenant_portfolio!(portfolio_id)
        Portfolio.joins(:session)
                 .where(sessions: { tenant_id: current_tenant_id })
                 .find(portfolio_id)
      end

      def find_tenant_vacancy(vacancy_id)
        return nil if vacancy_id.blank?

        Vacancy.unscoped.where(tenant_id: current_tenant_id).find_by(id: vacancy_id)
      end

      def portfolio_json(portfolio)
        session           = portfolio.session
        ordered_skills    = portfolio.portfolio_skills.includes(:assessor_override).order(:is_discovered, :id).to_a
        scored_configured = ordered_skills.reject(&:is_discovered)
        unassessed_skills = build_unassessed_skills(session, scored_configured)
        coverage_maps     = session.coverage_maps.to_a
        sanitized_err     = portfolio.failed? ? sanitize_generation_error(portfolio.generation_error) : nil

        {
          id:                portfolio.id,
          session_id:        portfolio.session_id,
          candidate_id:      portfolio.candidate_id,
          generation_status: portfolio.generation_status,
          generated_at:      portfolio.generated_at,
          generation_error:  sanitized_err&.dig(:message),
          error_code:        sanitized_err&.dig(:code),
          session_summary:   build_session_summary(session, scored_configured, unassessed_skills),
          skills:            ordered_skills.map { |s| portfolio_skill_json(s, coverage_maps) },
          unassessed_skills: unassessed_skills,
          overrides:         portfolio.assessor_overrides.order(:id).map(&method(:override_json))
        }
      end

      def build_unassessed_skills(session, scored_configured)
        configured_defs = session.assessment.assessment_skills.order(:display_order).to_a
        coverage_maps   = session.coverage_maps.reject(&:is_discovered).to_a

        configured_defs.each_with_object([]) do |skill_def, list|
          scored = scored_configured.find do |ps|
            (skill_def.skill_id.present? && ps.skill_id.to_s.casecmp?(skill_def.skill_id.to_s)) ||
              ps.skill_label.to_s.casecmp?(skill_def.skill_label.to_s)
          end
          next if scored

          map = coverage_maps.find do |cm|
            (skill_def.skill_id.present? && cm.skill_id.to_s.casecmp?(skill_def.skill_id.to_s)) ||
              cm.skill_label.to_s.casecmp?(skill_def.skill_label.to_s)
          end

          state       = map&.state || 'not_yet'
          probe_count = map&.probe_count.to_i
          reason      = state == 'not_yet' || probe_count.zero? ? 'not_probed' : 'insufficient_evidence'

          list << {
            skill_id:       skill_def.skill_id,
            skill_label:    skill_def.skill_label,
            expected_level: skill_def.expected_level,
            state:          state,
            probe_count:    probe_count,
            reason:         reason
          }
        end
      end

      def build_session_summary(session, scored_configured, unassessed_skills)
        configured_defs = session.assessment.assessment_skills.to_a
        coverage_maps   = session.coverage_maps.reject(&:is_discovered).to_a

        covered_count = scored_configured.count do |ps|
          map = coverage_maps.find do |cm|
            (ps.skill_id.present? && cm.skill_id.to_s.casecmp?(ps.skill_id.to_s)) ||
              cm.skill_label.to_s.casecmp?(ps.skill_label.to_s)
          end
          map&.state == 'covered'
        end

        configured_count = configured_defs.size
        unassessed_count = unassessed_skills.size
        assessed_count   = [configured_count - unassessed_count, scored_configured.size].max

        {
          candidate_name:          session.candidate_name,
          status:                  session.status,
          end_reason:              session.end_reason,
          started_at:              session.started_at,
          ended_at:                session.ended_at,
          duration_seconds:        session.duration_seconds,
          configured_skills_count: configured_count,
          assessed_skills_count:   assessed_count,
          covered_skills_count:    covered_count,
          unassessed_skills_count: unassessed_count
        }
      end

      def portfolio_skill_json(skill, coverage_maps = [])
        map = coverage_maps.find do |cm|
          (skill.skill_id.present? && cm.skill_id.to_s.casecmp?(skill.skill_id.to_s)) ||
            cm.skill_label.to_s.casecmp?(skill.skill_label.to_s)
        end

        {
          id:                 skill.id,
          skill_id:           skill.skill_id,
          skill_label:        skill.skill_label,
          is_discovered:      skill.is_discovered,
          ai_level:           skill.ai_level,
          ai_confidence:      skill.ai_confidence,
          coverage_state:     map&.state,
          probe_count:        map&.probe_count,
          evidence:           skill.evidence_quotes,
          competency_summary: skill.competency_summary
        }
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

      def fit_gap_json(report, portfolio: nil, comparisons_override: nil)
        target_portfolio = portfolio || report.portfolio
        overrides_by_skill = index_overrides_by_skill(target_portfolio)
        raw_comparisons = comparisons_override || report.skill_comparisons

        {
          id:                report.id,
          portfolio_id:      report.portfolio_id,
          vacancy_id:        report.vacancy_id,
          skill_comparisons: Array(raw_comparisons).map { |c| normalize_comparison_entry(c, overrides_by_skill) },
          culture_narrative: report.culture_narrative,
          overall_narrative: report.overall_narrative,
          generated_at:      report.generated_at
        }
      end

      def index_overrides_by_skill(portfolio)
        return {} unless portfolio

        portfolio.portfolio_skills.includes(:assessor_override).each_with_object({}) do |ps, map|
          key = (ps.skill_id.presence || ps.skill_label).to_s.downcase
          map[key] = ps
          map[ps.skill_label.to_s.downcase] = ps
        end
      end

      def normalize_comparison_entry(entry, overrides_by_skill)
        item = entry.with_indifferent_access
        key  = (item[:skill_id].presence || item[:skill_label]).to_s.downcase
        ps   = overrides_by_skill[key] || overrides_by_skill[item[:skill_label].to_s.downcase]
        ov   = ps&.assessor_override

        required_level = item[:required_level] || item[:expected_level]
        is_override    = if !item[:is_override].nil?
                           ActiveModel::Type::Boolean.new.cast(item[:is_override])
                         elsif !item[:overridden].nil?
                           ActiveModel::Type::Boolean.new.cast(item[:overridden])
                         else
                           ov.present?
                         end

        {
          skill_label:       item[:skill_label],
          skill_id:          item[:skill_id],
          required_level:    required_level,
          expected_level:    item[:expected_level] || required_level,
          candidate_level:   item[:candidate_level],
          ai_level:          item[:ai_level] || ps&.ai_level,
          is_override:       is_override,
          assessor_notes:    item[:assessor_notes] || ov&.assessor_notes,
          assessment_status: item[:assessment_status] || (item[:result] == 'not_assessed' ? 'not_probed' : 'covered'),
          result:            item[:result],
          delta:             item[:delta],
          confidence:        item[:confidence]
        }
      end

      def sanitize_generation_error(raw_error)
        text = raw_error.to_s
        code = if text.match?(/timeout|timed out/i)
                 'ai_service_timeout'
               elsif text.match?(/json|parse/i)
                 'invalid_ai_response'
               else
                 'ai_service_unavailable'
               end

        {
          code:    code,
          message: "We couldn't complete the AI portfolio analysis due to an upstream service error. Your interview transcript is safe—please retry generation."
        }
      end

      def build_export_json(portfolio, vacancy = nil)
        data = {
          exported_at: Time.current.iso8601,
          portfolio:   portfolio_json(portfolio)
        }

        if vacancy.present?
          report = FitGapReport.find_by(portfolio_id: portfolio.id, vacancy_id: vacancy.id)
          if report
            fresh_comparisons = if FitGap::GenerationTracker.report_stale?(portfolio, report)
                                  FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy).build_skill_comparisons
                                end
            data[:fit_gap_report] = fit_gap_json(report, portfolio: portfolio, comparisons_override: fresh_comparisons)
          else
            data[:fit_gap_report] = nil
          end
        end

        data
      end
    end
  end
end
