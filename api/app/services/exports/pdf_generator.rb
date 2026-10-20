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

    def initialize(portfolio:, vacancy: nil)
      @portfolio   = portfolio
      @vacancy     = vacancy
      @session     = portfolio.session
      @assessment  = @session.assessment
      @fit_gap     = vacancy ? FitGapReport.find_by(portfolio: portfolio, vacancy: vacancy) : nil
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

      pdf.stroke_horizontal_rule
      pdf.move_down 10
    end

    def render_portfolio_section(pdf)
      pdf.font_size(16) { pdf.text 'Skill Portfolio', style: :bold }
      pdf.move_down 8

      skills = @portfolio.portfolio_skills.includes(:assessor_override).order(:is_discovered, :id).to_a
      configured = skills.reject(&:is_discovered)
      discovered = skills.select(&:is_discovered)
      unassessed = build_unassessed_skills(configured)

      if configured.any?
        pdf.font_size(13) { pdf.text 'Assessed Skills', style: :bold }
        pdf.move_down 6
        configured.each { |skill| render_skill_card(pdf, skill) }
      end

      if unassessed.any?
        pdf.move_down 6
        pdf.font_size(13) { pdf.text 'Unassessed Configured Skills', style: :bold }
        pdf.move_down 4
        unassessed.each do |u|
          reason_label = u[:reason] == 'insufficient_evidence' ? 'Probed - Insufficient Evidence' : 'Not Probed'
          expected_text = u[:expected_level] ? " (Expected: L#{u[:expected_level]})" : ''
          pdf.font_size(10) { pdf.text "- #{u[:skill_label]}#{expected_text} : #{reason_label}" }
        end
        pdf.move_down 8
      end

      if discovered.any?
        pdf.move_down 6
        pdf.font_size(13) { pdf.text 'Discovered Skills', style: :bold }
        pdf.move_down 6
        discovered.each { |skill| render_skill_card(pdf, skill) }
      end
    end

    def render_skill_card(pdf, skill)
      override = skill.assessor_override
      effective_level = override ? override.override_level : skill.ai_level

      pdf.font_size(11) do
        pdf.text skill.skill_label.to_s, style: :bold

        level_text = "Level: #{LEVEL_LABELS[effective_level]}"
        level_text += " (AI: #{LEVEL_LABELS[skill.ai_level]} -> Override: #{LEVEL_LABELS[override.override_level]})" if override
        level_text += "  |  Confidence: #{CONFIDENCE_LABELS[skill.ai_confidence] || skill.ai_confidence}"
        pdf.text level_text
      end

      pdf.move_down 4

      if skill.competency_summary.present?
        pdf.font_size(10) { pdf.text skill.competency_summary }
      end

      if skill.evidence_quotes.any?
        pdf.move_down 4
        pdf.font_size(10) do
          pdf.text 'Evidence:', style: :bold
          skill.evidence_quotes.each { |quote| pdf.text "  - #{quote}" }
        end
      end

      if override&.assessor_notes.present?
        pdf.move_down 4
        pdf.font_size(10) do
          pdf.text 'Latest Assessor Override Note:', style: :bold
          pdf.text "  #{override.assessor_notes}"
        end
      end

      pdf.stroke do
        pdf.stroke_color 'CCCCCC'
        pdf.horizontal_rule
      end
      pdf.move_down 8
    end

    def render_fit_gap_section(pdf)
      pdf.start_new_page

      pdf.font_size(16) { pdf.text "Fit/Gap Analysis - #{@vacancy.role_title}", style: :bold }
      pdf.move_down 8

      comparisons = if FitGap::GenerationTracker.report_stale?(@portfolio, @fit_gap)
                      FitGap::Engine.new(portfolio: @portfolio, vacancy: @vacancy).build_skill_comparisons
                    else
                      @fit_gap.skill_comparisons
                    end

      table_data = [%w[Skill Required Candidate Result Delta]]
      Array(comparisons).each do |raw|
        c = raw.with_indifferent_access
        req_level  = c[:required_level] || c[:expected_level]
        cand_level = c[:candidate_level]
        cand_text  = if cand_level
                       c[:is_override] ? "L#{cand_level} (Override)" : "L#{cand_level}"
                     else
                       'Not Assessed'
                     end

        table_data << [
          c[:skill_label],
          req_level ? "L#{req_level}" : '-',
          cand_text,
          RESULT_LABELS[c[:result]] || c[:result],
          c[:delta] ? (c[:delta].positive? ? "+#{c[:delta]}" : c[:delta].to_s) : '-'
        ]
      end

      pdf.table(table_data, header: true, width: pdf.bounds.width) do |t|
        t.row(0).font_style = :bold
        t.row(0).background_color = 'E5E7EB'
        t.cells.padding = [6, 8]
        t.cells.size = 10
      end

      if @fit_gap.overall_narrative.present?
        pdf.move_down 12
        pdf.font_size(12) { pdf.text 'Overall Hiring Recommendation', style: :bold }
        pdf.move_down 4
        pdf.font_size(10) { pdf.text @fit_gap.overall_narrative }
      end

      if @fit_gap.culture_narrative.present?
        pdf.move_down 8
        pdf.font_size(12) { pdf.text 'Culture & Competency Fit', style: :bold }
        pdf.move_down 4
        pdf.font_size(10) { pdf.text @fit_gap.culture_narrative }
      end
    end

    def build_unassessed_skills(scored_configured)
      configured_defs = @assessment.assessment_skills.order(:display_order).to_a
      coverage_maps   = @session.coverage_maps.reject(&:is_discovered).to_a

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
          skill_label:    skill_def.skill_label,
          expected_level: skill_def.expected_level,
          reason:         reason
        }
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
  end
end
