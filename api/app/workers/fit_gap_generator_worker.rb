# frozen_string_literal: true

class FitGapGeneratorWorker
  include Sidekiq::Worker

  sidekiq_options queue: :default, retry: 2

  def perform(report_id, generation)
    report = FitGapReport.find(report_id)
    generation = generation.to_i

    unless report.portfolio.session.tenant_id == report.vacancy.tenant_id
      FitGapReport
        .where(id: report.id, narrative_generation: generation)
        .update_all(
          narrative_status: "failed",
          narrative_error: "Tenant boundary validation failed"
        )
      Rails.logger.error("[N13] Tenant boundary validation failed for report=#{report_id}")
      return
    end

    claimed = FitGapReport
              .where(
                id: report.id,
                narrative_generation: generation,
                narrative_status: %w[pending failed]
              )
              .update_all(
                narrative_status: "generating",
                narrative_error: nil
              )

    # Another worker owns this generation, or a newer override invalidated it.
    return unless claimed == 1

    report.reload
    narratives = FitGap::NarrativeGenerator.new(
      vacancy: report.vacancy
    ).generate_narrative!(report.skill_comparisons)

    FitGapReport
      .where(
        id: report.id,
        narrative_generation: generation,
        narrative_status: "generating"
      )
      .update_all(
        culture_narrative: narratives[:culture],
        overall_narrative: narratives[:overall],
        narrative_status: "complete",
        narrative_error: nil,
        narrative_generated_at: Time.current
      )
  rescue ActiveRecord::RecordNotFound
    Rails.logger.warn("[N13] FitGap report #{report_id} not found — skipping")
  rescue StandardError => e
    FitGapReport
      .where(
        id: report_id,
        narrative_generation: generation,
        narrative_status: "generating"
      )
      .update_all(
        narrative_status: "failed",
        narrative_error: "Narrative generation failed (#{e.class.name})"
      )

    Rails.logger.error("[N13] Narrative generation failed for report=#{report_id}: #{e.class}")
    raise
  end
end
