# frozen_string_literal: true

require "digest"
require "json"
require "time"

module FitGap
  # Serializes report generation requests around the unique (portfolio, vacancy)
  # row. The timestamp is a lease token, so an older worker cannot publish over a
  # later request. Queue operations are idempotent for equivalent input.
  class ReportScheduler
    LEASE_TIMEOUT = 15.minutes

    def self.enqueue(portfolio:, vacancy:, force: false)
      return nil unless portfolio && vacancy
      return nil unless portfolio.session.tenant_id == vacancy.tenant_id

      fingerprint = input_fingerprint(portfolio: portfolio, vacancy: vacancy)
      now = Time.current
      should_enqueue = false
      report = nil
      lease_token = nil

      FitGapReport.transaction do
        report = FitGapReport.create_or_find_by!(
          portfolio_id: portfolio.id,
          vacancy_id: vacancy.id
        ) do |row|
          row.skill_comparisons = []
          row.generation_status = "queued"
          row.generation_error = nil
          row.generation_started_at = now
          row.input_fingerprint = fingerprint
          row.generated_at = nil
        end

        newly_created = report.previously_new_record?
        report.with_lock do
          if newly_created
            should_enqueue = true
          else
            input_changed = report.input_fingerprint != fingerprint
            lease_expired = report.generation_started_at.nil? ||
                            report.generation_started_at < LEASE_TIMEOUT.ago

            refreshable_complete_report = report.complete? && (force || input_changed)
            recoverable_report = report.failed? || report.stale? ||
                                 ((report.generating? || report.generation_status == "queued") && lease_expired)
            superseded_report = input_changed && (report.generating? || report.generation_status == "queued")
            if refreshable_complete_report || recoverable_report || superseded_report
              report.update!(
                generation_status: "queued",
                generation_error: nil,
                generation_started_at: now,
                input_fingerprint: fingerprint
              )
              should_enqueue = true
            end
          end
        end
      end

      if should_enqueue
        report.reload
        lease_token = report.generation_started_at.utc.iso8601(6)
        jid = FitGapGeneratorWorker.perform_async(portfolio.id, vacancy.id, lease_token)
        mark_failed_if_current(report, lease_token, "Report generation could not be queued") unless jid
      end

      report.reload
    rescue StandardError => e
      mark_failed_if_current(report, lease_token, "Report generation could not be scheduled") if report && lease_token
      Rails.logger.error("[N13] Report scheduling failed: #{e.class}")
      report
    end

    def self.input_fingerprint(portfolio:, vacancy:)
      skills = portfolio.portfolio_skills.includes(:assessor_override).order(:id).map do |skill|
        override = skill.assessor_override
        {
          skill_id: skill.skill_id,
          skill_label: skill.skill_label.to_s.strip.downcase,
          ai_level: skill.ai_level,
          confidence: skill.ai_confidence,
          evidence_digest: Digest::SHA256.hexdigest(JSON.generate(skill.evidence_quotes)),
          override_level: override&.override_level
        }
      end

      requirements = vacancy.vacancy_skills.order(:id).map do |skill|
        {
          skill_id: skill.skill_id,
          skill_label: skill.skill_label.to_s.strip.downcase,
          expected_level: skill.expected_level
        }
      end

      payload = {
        portfolio_id: portfolio.id,
        skills: skills,
        vacancy_id: vacancy.id,
        role_title: vacancy.role_title,
        culture_dimensions: vacancy.culture_dimensions,
        competency_expectations: vacancy.competency_expectations,
        vacancy_skills: requirements
      }
      Digest::SHA256.hexdigest(JSON.generate(payload))
    end

    def self.mark_failed_if_current(report, lease_token, message)
      report.with_lock do
        current_token = report.generation_started_at&.utc&.iso8601(6)
        matches = lease_token.nil? || current_token == lease_token
        if matches && report.generation_status != "complete"
          report.update!(
            generation_status: "failed",
            generation_error: message,
            generation_started_at: nil
          )
        end
      end
    rescue StandardError => e
      Rails.logger.error("[N13] Could not update failed report state: #{e.class}")
    end
    private_class_method :mark_failed_if_current
  end
end
