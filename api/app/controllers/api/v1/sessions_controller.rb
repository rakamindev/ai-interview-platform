# frozen_string_literal: true

module Api
  module V1
    class SessionsController < ApiController
      authorize_auth_token! :portal, except: %i[candidate_info audio_complete update_progress]
      skip_before_action :require_tenant!, only: %i[candidate_info audio_complete update_progress]

      before_action :require_assessor!, only: %i[create bulk_create end_session]
      before_action :set_session, only: %i[show end_session coverage transcript]

      # GET /api/v1/sessions (Cross-assessment list for Candidates page)
      def all_sessions
        scope = Session.includes(:assessment, :portfolio).where(tenant_id: current_tenant_id).order(created_at: :desc)

        # Status filter
        if params[:status].present? && params[:status] != 'all'
          case params[:status]
          when 'active'
            scope = scope.where(status: 'active')
          when 'ended'
            scope = scope.where(status: 'ended')
          when 'pending'
            scope = scope.where(status: 'pending')
          when 'needs_review'
            scope = scope.joins(:portfolio).where(status: 'ended', portfolios: { generation_status: 'complete' })
          end
        end

        # Search filter
        if params[:search].present?
          query = "%#{params[:search].to_s.downcase}%"
          scope = scope.joins(:assessment).where(
            'LOWER(sessions.candidate_name) LIKE :q OR LOWER(assessments.name) LIKE :q',
            q: query
          )
        end

        # Assessment filter
        if params[:assessment_id].present?
          scope = scope.where(assessment_id: params[:assessment_id])
        end

        sessions = paginate(scope)

        json_response(
          sessions: sessions.map(&method(:session_with_assessment_json)),
          meta: pagination_meta(sessions)
        )
      end

      # GET /api/v1/assessments/:assessment_id/sessions
      def index
        assessment = Assessment.find(params[:assessment_id])
        sessions = assessment.sessions.order(created_at: :desc)

        json_response(sessions: sessions.map(&method(:session_json)))
      rescue ActiveRecord::RecordNotFound
        json_error("Assessment not found", :not_found)
      end

      # POST /api/v1/assessments/:assessment_id/sessions
      def create
        assessment = Assessment.find(params[:assessment_id])

        session = assessment.sessions.new(
          candidate_id:   params.dig(:session, :candidate_id),
          candidate_name: params.dig(:session, :candidate_name).presence,
          tenant_id:      current_tenant_id
        )

        if session.save
          json_response(
            {
              session:    session_json(session),
              invite_url: session.invite_url
            },
            :created
          )
        else
          json_error(session.errors.full_messages.first, :unprocessable_entity)
        end
      rescue ActiveRecord::RecordNotFound
        json_error("Assessment not found", :not_found)
      end

      # POST /api/v1/assessments/:assessment_id/sessions/bulk
      def bulk_create
        assessment = Assessment.find(params[:assessment_id])
        candidates = params[:candidates] || []

        if candidates.blank? && params[:names].present?
          candidates = params[:names].map { |n| { name: n } }
        end

        candidates = [{ name: nil }] if candidates.blank?

        created_sessions = []
        ActiveRecord::Base.transaction do
          candidates.each do |cand|
            name = cand.is_a?(Hash) ? (cand[:name] || cand['name']) : cand.to_s
            s = assessment.sessions.create!(
              candidate_name: name.presence,
              tenant_id: current_tenant_id
            )
            created_sessions << {
              session: session_json(s),
              invite_url: s.invite_url
            }
          end
        end

        json_response({ sessions: created_sessions, count: created_sessions.size }, :created)
      rescue ActiveRecord::RecordNotFound
        json_error("Assessment not found", :not_found)
      rescue StandardError => e
        json_error(e.message, :unprocessable_entity)
      end

      # GET /api/v1/sessions/:id
      def show
        json_response(
          session: session_json(@session).merge(
            assessment: {
              id:             @session.assessment.id,
              name:           @session.assessment.name,
              time_limit_min: @session.assessment.time_limit_min,
              language:       @session.assessment.language || 'en'
            },
            portfolio: @session.portfolio && {
              id: @session.portfolio.id,
              status: @session.portfolio.generation_status
            }
          )
        )
      end

      # POST /api/v1/sessions/:id/end
      def end_session
        if @session.ended?
          return json_error("Session is already ended", :unprocessable_entity)
        end

        reason = params.dig(:session, :reason) || "manual_assessor"

        unless Session::END_REASONS.include?(reason)
          return json_error("Invalid end reason", :unprocessable_entity)
        end

        result = Sessions::EndHandler.new(@session).call(reason: reason)

        if result
          json_response(session: session_json(@session.reload))
        else
          json_error("Failed to end session", :unprocessable_entity)
        end
      end

      # GET /api/v1/sessions/:id/coverage
      def coverage
        maps       = @session.coverage_maps.configured.order(:id)
        discovered = @session.coverage_maps.discovered.order(:id)

        json_response(
          skills:     maps.map(&method(:coverage_map_json)),
          discovered: discovered.map(&method(:coverage_map_json)),
          updated_at: @session.coverage_maps.maximum(:updated_at)
        )
      end

      # GET /api/v1/sessions/:id/transcript
      def transcript
        from_turn = params[:from_turn].to_i
        turns     = @session.transcript_turns
                             .ordered
                             .then { from_turn > 0 ? _1.where("turn_number >= ?", from_turn) : _1 }

        json_response(
          turns: turns.map do |t|
            {
              id:             t.id,
              turn_number:    t.turn_number,
              speaker:        t.speaker,
              text:           t.text,
              audio_start_ms: t.audio_start_ms,
              audio_end_ms:   t.audio_end_ms,
              created_at:     t.created_at
            }
          end,
          total: turns.count
        )
      end

      # POST /sessions/:token/audio_complete  — no JWT, invite token in URL
      def audio_complete
        session = Session.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid or expired invite token", :not_found) unless session

        return json_response(ended: true, message: "Session already ended") if session.ended?

        Sessions::EndHandler.new(session).call(reason: 'all_covered')
        json_response(ended: true, message: "Session ended")
      end

      # GET /sessions/:token/candidate  — no JWT, invite token in URL
      def candidate_info
        session = Session.unscoped.find_by(invite_token: params[:token])

        unless session
          return json_error("Invalid or expired invite token", :not_found)
        end

        assessment = Assessment.unscoped
                               .where(tenant_id: session.tenant_id)
                               .find_by(id: session.assessment_id)

        unless assessment
          return json_error("Assessment not found", :not_found)
        end

        # Stage calculation if attribute not present in older DBs
        stage = if session.has_attribute?(:candidate_stage) && session.candidate_stage.present?
                  session.candidate_stage
                elsif session.ended?
                  'complete'
                elsif session.active?
                  'live'
                else
                  'welcome'
                end

        skills_list = assessment.assessment_skills.order(:display_order).map do |s|
          {
            id:             s.id,
            skill_label:    s.skill_label,
            expected_level: s.expected_level,
            scope_include:  s.scope_include
          }
        end

        json_response(
          session_id:             session.id,
          role_title:             assessment.name,
          time_limit_min:         assessment.time_limit_min,
          language:               assessment.language || 'en',
          session_status:         session.status,
          candidate_name:         session.candidate_name,
          candidate_stage:        stage,
          consent_accepted_at:    session.has_attribute?(:consent_accepted_at) ? session.consent_accepted_at : nil,
          device_check_passed_at: session.has_attribute?(:device_check_passed_at) ? session.device_check_passed_at : nil,
          started_at:             session.started_at,
          duration_seconds:       session.duration_seconds,
          skills:                 skills_list
        )
      end

      # POST /sessions/:token/progress — no JWT, candidate stage update
      def update_progress
        session = Session.unscoped.find_by(invite_token: params[:token])
        return json_error("Invalid or expired invite token", :not_found) unless session

        stage = params[:stage].to_s.presence
        attrs = {}

        if session.has_attribute?(:candidate_stage) && stage.present?
          attrs[:candidate_stage] = stage
        end

        if params[:consent_accepted] && session.has_attribute?(:consent_accepted_at)
          attrs[:consent_accepted_at] = Time.current
        end

        if params[:device_check_passed] && session.has_attribute?(:device_check_passed_at)
          attrs[:device_check_passed_at] = Time.current
        end

        if stage == 'live' && session.has_attribute?(:resume_count)
          attrs[:resume_count] = (session.resume_count || 0) + 1
        end

        if session.has_attribute?(:last_seen_at)
          attrs[:last_seen_at] = Time.current
        end

        session.update(attrs) if attrs.any?

        json_response(
          success: true,
          candidate_stage: session.has_attribute?(:candidate_stage) ? session.candidate_stage : stage,
          consent_accepted_at: session.has_attribute?(:consent_accepted_at) ? session.consent_accepted_at : nil,
          device_check_passed_at: session.has_attribute?(:device_check_passed_at) ? session.device_check_passed_at : nil,
          resume_count: session.has_attribute?(:resume_count) ? session.resume_count : nil,
          session_status: session.status
        )
      end

      private

      def require_assessor!
        return if current_user && %w[admin assessor].include?(current_user.role)

        raise ExceptionHandler::Unauthorized, "Assessor or Admin permissions required"
      end

      def set_session
        @session = Session.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        json_error("Session not found", :not_found)
      end

      def session_json(session)
        {
          id:               session.id,
          assessment_id:    session.assessment_id,
          tenant_id:        session.tenant_id,
          candidate_id:     session.candidate_id,
          candidate_name:   session.candidate_name,
          invite_token:     session.invite_token,
          invite_url:       session.invite_url,
          status:           session.status,
          end_reason:       session.end_reason,
          started_at:       session.started_at,
          ended_at:         session.ended_at,
          duration_seconds: session.duration_seconds,
          candidate_stage:  session.has_attribute?(:candidate_stage) ? session.candidate_stage : nil,
          created_at:       session.created_at
        }
      end

      def session_with_assessment_json(session)
        session_json(session).merge(
          assessment_name: session.assessment&.name,
          time_limit_min:  session.assessment&.time_limit_min,
          portfolio_id:    session.portfolio&.id,
          portfolio_status: session.portfolio&.generation_status
        )
      end

      def coverage_map_json(map)
        {
          id:            map.id,
          skill_id:      map.skill_id,
          skill_label:   map.skill_label,
          is_discovered: map.is_discovered,
          state:         map.state,
          probe_count:   map.probe_count,
          last_signal:   map.last_signal,
          updated_at:    map.updated_at
        }
      end

      def pagination_meta(collection)
        {
          current_page: collection.current_page,
          total_pages:  collection.total_pages,
          total_count:  collection.total_count,
          per_page:     collection.limit_value
        }
      end
    end
  end
end
