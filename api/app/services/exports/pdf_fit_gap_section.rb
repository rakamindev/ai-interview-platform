# frozen_string_literal: true

module Exports
  # Fit/gap part of the PDF, written only from FitGap::ReportPresenter so the
  # document says exactly what the Fit/Gap page says.
  class PdfFitGapSection
    include PdfLabels

    def initialize(canvas, report)
      @canvas = canvas
      @report = report
    end

    def render(role_title)
      @canvas.pdf.start_new_page
      @canvas.heading("Fit/Gap Report: #{role_title}", size: 16)

      if @report.comparisons.empty?
        @canvas.text('This vacancy has no required skills, so there is nothing to compare.')
        return
      end

      render_summary
      @report.comparisons.each { |comparison| render_comparison(comparison) }
      render_follow_up
      render_narrative
    end

    private

    def render_summary
      s = @report.summary
      @canvas.text("Counted toward fit: #{s[:evidenced]} of #{s[:total]}", style: :bold)
      @canvas.text("Match #{s[:match]}, Exceeds #{s[:exceed]}, Gap #{s[:gap]}. " \
                   "Not counted: #{s[:not_assessed]} not assessed, #{s[:low_confidence]} low confidence. " \
                   "Assessor overrides #{s[:overridden]}, confirmed #{s[:confirmed]}.")
      @canvas.pdf.move_down 8
    end

    def render_comparison(comparison)
      @canvas.text(comparison[:skill_label], size: 11, style: :bold)
      @canvas.text("Required: #{level(comparison[:expected_level])}  |  " \
                   "Candidate: #{candidate(comparison)}  |  Result: #{result(comparison)}")
      @canvas.pdf.move_down 6
    end

    def candidate(comparison)
      text = level(comparison[:candidate_level])
      case comparison[:level_source]
      when 'assessor_override'
        ai = comparison[:ai_level] ? "AI #{level(comparison[:ai_level])}" : 'AI not assessed'
        "#{text} (Assessor override, #{ai})"
      when 'assessor_confirmed' then "#{text} (Confirmed by assessor)"
      when 'ai' then "#{text} (AI, #{CONFIDENCE.fetch(comparison[:confidence], comparison[:confidence])} confidence)"
      else text
      end
    end

    def result(comparison)
      delta = comparison[:delta]
      case comparison[:result]
      when 'match' then 'Match'
      when 'exceed' then "Exceeds +#{delta}"
      when 'gap' then "Gap #{delta}"
      when 'low_confidence' then "Low confidence, #{TENTATIVE[comparison[:tentative_direction]]} (not counted)"
      else "#{NOT_ASSESSED} (not counted)"
      end
    end

    def render_follow_up
      return if @report.follow_up.empty?

      @canvas.pdf.move_down 4
      @canvas.heading('Follow up (not counted toward fit)', size: 12)
      @report.follow_up.each { |label| @canvas.text("• #{label}") }
    end

    def render_narrative
      narrative = @report.narrative
      @canvas.pdf.move_down 10
      @canvas.heading("AI narrative: #{NARRATIVE_STATUS.fetch(narrative[:status])}", size: 12)
      return @canvas.text(NARRATIVE_STATUS_TEXT.fetch(narrative[:status])) unless narrative[:status] == 'complete'

      @canvas.text(narrative[:label], style: :bold, color: '555555')
      texts = [narrative[:culture], narrative[:overall]].compact_blank
      return @canvas.text('No AI narrative text is available.') if texts.empty?

      texts.each { |paragraph| @canvas.text(paragraph) }
    end
  end
end
