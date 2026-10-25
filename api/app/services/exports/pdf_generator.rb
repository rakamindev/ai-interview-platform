# frozen_string_literal: true

require 'prawn'
require 'prawn/table'

module Exports
  # N14: Generates a PDF export of a portfolio, optionally including a fit/gap report.
  # Returns the PDF as a binary string.
  class PdfGenerator
    LEVEL_LABELS = { 1 => 'L1', 2 => 'L2', 3 => 'L3', 4 => 'L4', 5 => 'L5' }.freeze
    CONFIDENCE_LABELS = { 'high' => 'High', 'medium' => 'Medium', 'low' => 'Low' }.freeze
    RESULT_LABELS = {
      'match'        => 'Match',
      'gap'          => 'Gap',
      'exceed'       => 'Exceeds',
      'not_assessed' => 'Not Assessed'
    }.freeze

    def initialize(portfolio:, vacancy: nil, fit_gap_report: nil, stale: false)
      @portfolio   = portfolio
      @vacancy     = vacancy
      @session     = portfolio.session
      @assessment  = @session.assessment
      @fit_gap     = fit_gap_report || (vacancy ? FitGapReport.find_by(portfolio: portfolio, vacancy: vacancy) : nil)
      @stale       = stale
    end

    # Returns PDF binary string.
    def call
      Prawn::Document.new(page_size: 'A4', margin: [40, 50, 40, 50]) do |pdf|
        render_header(pdf)
        render_portfolio_section(pdf)
        render_fit_gap_section(pdf) if @fit_gap
        render_footer(pdf)
      end.render
    end

    private

    def render_header(pdf)
      pdf.font_size(22) { pdf.text @assessment.name, style: :bold }
      pdf.move_down 4
      pdf.font_size(12) { pdf.text "Skill Portfolio Report" }
      pdf.move_down 4

      pdf.font_size(10) do
        pdf.text "Session: #{@session.id}"
        pdf.text "Duration: #{format_duration(@session.duration_seconds)}"
        pdf.text "Generated: #{Time.current.strftime('%Y-%m-%d %H:%M')}"
      end

      if @stale
        pdf.move_down 6
        pdf.fill_color 'B91C1C'
        pdf.text 'STALE FIT/GAP REPORT - regeneration failed; use for reference only.', style: :bold
        pdf.fill_color '000000'
      end

      pdf.stroke_horizontal_rule
      pdf.move_down 10
    end

    def render_portfolio_section(pdf)
      pdf.font_size(16) { pdf.text "Skill Portfolio", style: :bold }
      pdf.move_down 8

      skills = @portfolio.portfolio_skills.includes(:assessor_override)
      configured = skills.reject(&:is_discovered)
      discovered = skills.select(&:is_discovered)

      if configured.any?
        pdf.font_size(13) { pdf.text "Assessed Skills", style: :bold }
        pdf.move_down 6
        configured.each { |skill| render_skill_card(pdf, skill) }
      end

      if discovered.any?
        pdf.move_down 6
        pdf.font_size(13) { pdf.text "Discovered Skills", style: :bold }
        pdf.move_down 6
        discovered.each { |skill| render_skill_card(pdf, skill) }
      end
    end

    def render_skill_card(pdf, skill)
      override = skill.assessor_override
      effective_level = override ? override.override_level : skill.ai_level

      pdf.font_size(11) do
        pdf.text "#{skill.skill_label}", style: :bold

        level_text = "Level: #{LEVEL_LABELS[effective_level]}"
        level_text += " (AI: #{LEVEL_LABELS[skill.ai_level]} -> Override: #{LEVEL_LABELS[override.override_level]})" if override
        level_text += "  |  Confidence: #{CONFIDENCE_LABELS[skill.ai_confidence] || skill.ai_confidence}"
        pdf.text level_text
      end

      pdf.move_down 4

      if skill.competency_summary.present?
        pdf.font_size(10) { pdf.text skill.competency_summary }
      end

      if skill.evidence_items.any?
        pdf.move_down 4
        pdf.font_size(10) do
          pdf.text "Evidence:", style: :bold
          skill.evidence_items.each do |citation|
            if citation['verification_status'] == 'verified'
              pdf.text "  - \"#{citation['quote']}\" (Verified transcript turn #{citation['turn_number']})"
            else
              pdf.text "  - Legacy evidence - transcript link unavailable: #{citation['quote']}"
            end
          end
        end
      elsif skill.evidence_status == 'insufficient'
        pdf.move_down 4
        pdf.font_size(10) { pdf.text 'Evidence: Insufficient verified transcript evidence' }
      end

      if override&.assessor_notes.present?
        pdf.move_down 4
        pdf.font_size(10) do
          pdf.text "Assessor Note:", style: :bold
          pdf.text "  #{override.assessor_notes}"
        end
      end

      pdf.stroke { pdf.stroke_color 'CCCCCC'; pdf.horizontal_rule }
      pdf.move_down 8
    end

    def render_fit_gap_section(pdf)
      pdf.start_new_page

      pdf.font_size(16) { pdf.text "Fit/Gap Analysis - #{@vacancy.role_title}", style: :bold }
      pdf.move_down 8

      if @stale
        pdf.fill_color 'B91C1C'
        pdf.text 'STALE - This analysis does not reflect the latest inputs.', style: :bold
        pdf.fill_color '000000'
        pdf.move_down 8
      end

      comparisons = @fit_gap.skill_comparisons

      table_data = [['Skill', 'Required', 'Candidate', 'Result', 'Delta']]
      comparisons.each do |c|
        table_data << [
          c['skill_label'],
          c['expected_level'] ? "L#{c['expected_level']}" : '-',
          candidate_level_text(c),
          RESULT_LABELS[c['result']] || c['result'],
          c['delta'] ? (c['delta'] > 0 ? "+#{c['delta']}" : c['delta'].to_s) : '-'
        ]
      end

      pdf.table(table_data, header: true, width: pdf.bounds.width) do |t|
        t.row(0).font_style = :bold
        t.row(0).background_color = 'E5E7EB'
        t.cells.padding = [6, 8]
        t.cells.size = 10
      end

      if @fit_gap.culture_narrative.present?
        pdf.move_down 12
        pdf.font_size(12) { pdf.text "Culture & Competency Fit", style: :bold }
        pdf.move_down 4
        pdf.font_size(10) { pdf.text @fit_gap.culture_narrative }
      end

      if @fit_gap.overall_narrative.present?
        pdf.move_down 8
        pdf.font_size(12) { pdf.text "Overall Assessment", style: :bold }
        pdf.move_down 4
        pdf.font_size(10) { pdf.text @fit_gap.overall_narrative }
      end
    end

    def render_footer(pdf)
      pdf.number_pages "Page <page> of <total>",
                        at:     [pdf.bounds.left, 0],
                        width:  pdf.bounds.right,
                        align:  :center,
                        size:   9,
                        color:  '999999'
    end

    def format_duration(seconds)
      return 'N/A' unless seconds
      mins = seconds / 60
      secs = seconds % 60
      "#{mins}m #{secs}s"
    end

    def candidate_level_text(comparison)
      return '-' unless comparison['candidate_level']

      level = "L#{comparison['candidate_level']}"
      if comparison['rating_source'] == 'assessor_override'
        "#{level} (Assessor-adjusted from L#{comparison['ai_level']})"
      else
        "#{level} (AI rating)"
      end
    end
  end
end
