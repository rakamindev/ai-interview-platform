# frozen_string_literal: true

module Api
  module V1
    class DashboardController < ApiController
      authorize_auth_token! :assessor

      # GET /api/v1/dashboard/stats
      def stats
        assessments = Assessment.order(:created_at)
        status_pairs     = Session.group(:assessment_id, :status).count
        reason_pairs     = Session.ended.group(:assessment_id, :end_reason).count
        duration_pairs   = ended_durations.group(:assessment_id).average(:duration_seconds)

        rows_by_assessment = group_by_assessment(status_pairs)
        reasons_by_assessment = group_by_assessment(reason_pairs)

        summaries = assessments.map do |a|
          summary(a, rows_by_assessment[a.id] || {}, reasons_by_assessment[a.id] || {}, duration_pairs[a.id])
        end

        json_response(
          total: summaries.sum { |s| s[:total] },
          totals: merge_totals(summaries),
          started: summaries.sum { |s| s[:started] },
          completion_rate: global_rate(summaries),
          avg_duration_seconds: ended_durations.average(:duration_seconds)&.to_f,
          ended_reasons: all_reasons(reason_pairs),
          live_sessions: live_sessions_json,
          per_assessment: summaries
        )
      end

      # GET /api/v1/assessments/:assessment_id/dashboard
      def assessment
        assessment = Assessment.find(params[:assessment_id])
        sessions   = assessment.sessions
        statuses   = sessions.group(:status).count
        reasons    = sessions.ended.group(:end_reason).count
        durations  = sessions.ended.where.not(duration_seconds: nil)

        completed = statuses['ended'].to_i - reasons['error'].to_i
        started   = statuses['active'].to_i + statuses['ended'].to_i

        json_response(
          assessment_id: assessment.id,
          name: assessment.name,
          time_limit_min: assessment.time_limit_min,
          totals: {
            pending: statuses['pending'].to_i,
            active: statuses['active'].to_i,
            ended: completed,
            failed: statuses['failed'].to_i + reasons['error'].to_i
          },
          started: started,
          completion_rate: started.zero? ? nil : (completed.to_f / started * 100).round(1),
          avg_duration_seconds: durations.average(:duration_seconds)&.to_f,
          ended_reasons: reasons.map { |reason, count| { reason: reason, count: count } },
          last_started_at: sessions.maximum(:started_at)
        )
      rescue ActiveRecord::RecordNotFound
        json_error('Assessment not found', :not_found)
      end

      private

      def ended_durations
        Session.ended.where.not(duration_seconds: nil)
      end

      def group_by_assessment(pairs)
        pairs.each_with_object({}) do |(key, count), acc|
          (acc[key.first] ||= {})[key.last] = count
        end
      end

      def summary(assessment, statuses, reason_pairs, avg_duration)
        errors    = error_count(reason_pairs)
        completed = statuses['ended'].to_i - errors
        started   = statuses['active'].to_i + statuses['ended'].to_i

        {
          id: assessment.id,
          name: assessment.name,
          total: statuses.values.sum,
          started: started,
          completion_rate: started.zero? ? nil : (completed.to_f / started * 100).round(1),
          avg_duration_seconds: avg_duration&.to_f,
          totals: {
            pending: statuses['pending'].to_i,
            active: statuses['active'].to_i,
            ended: completed,
            failed: statuses['failed'].to_i + errors
          },
          ended_reasons: reason_pairs.map { |reason, count| { reason: reason, count: count } }
        }
      end

      def error_count(reason_pairs)
        reason_pairs.sum { |reason, count| reason == 'error' ? count : 0 }
      end

      def merge_totals(summaries)
        sums = Hash.new(0)
        summaries.each { |s| s[:totals].each { |status, count| sums[status] += count } }
        sums
      end

      def global_rate(summaries)
        started = summaries.sum { |s| s[:started] }
        return nil if started.zero?

        (summaries.sum { |s| s[:totals][:ended] }.to_f / started * 100).round(1)
      end

      def all_reasons(reason_pairs)
        totals = Hash.new(0)
        reason_pairs.each { |(_, reason), count| totals[reason] += count }
        totals.sort.map { |reason, count| { reason: reason, count: count } }
      end

      def live_sessions_json
        Session.active.includes(:assessment).order(started_at: :desc).map do |s|
          {
            id: s.id,
            assessment_id: s.assessment_id,
            assessment_name: s.assessment.name,
            candidate_name: s.candidate_name,
            started_at: s.started_at
          }
        end
      end
    end
  end
end
