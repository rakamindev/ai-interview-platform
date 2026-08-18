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
      write(pdf, @assessment.name, size: 22, style: :bold)
      pdf.move_down 4
      write(pdf, 'Skill Portfolio Report', size: 12)
      pdf.move_down 4

      write(pdf, "Session: #{@session.id}", size: 10)
      write(pdf, "Duration: #{format_duration(@session.duration_seconds)}", size: 10)
      write(pdf, "Generated: #{Time.current.strftime('%Y-%m-%d %H:%M')}", size: 10)

      pdf.stroke_horizontal_rule
      pdf.move_down 10
    end

    def render_portfolio_section(pdf)
      write(pdf, 'Skill Portfolio', size: 16, style: :bold)
      pdf.move_down 8

      skills = @portfolio.portfolio_skills.includes(:assessor_override)
      configured = skills.reject(&:is_discovered)
      discovered = skills.select(&:is_discovered)

      if configured.any?
        write(pdf, 'Assessed Skills', size: 13, style: :bold)
        pdf.move_down 6
        configured.each { |skill| render_skill_card(pdf, skill) }
      end

      if discovered.any?
        pdf.move_down 6
        write(pdf, 'Discovered Skills', size: 13, style: :bold)
        pdf.move_down 6
        discovered.each { |skill| render_skill_card(pdf, skill) }
      end
    end

    def render_skill_card(pdf, skill)
      override = skill.assessor_override
      effective_level = override ? override.override_level : skill.ai_level

      write(pdf, skill.skill_label, size: 11, style: :bold)

      level_text = "Level: #{LEVEL_LABELS[effective_level]}"
      if override
        level_text += " (AI: #{LEVEL_LABELS[skill.ai_level]} -> Override: #{LEVEL_LABELS[override.override_level]})"
      end
      level_text += "  |  Confidence: #{CONFIDENCE_LABELS[skill.ai_confidence] || skill.ai_confidence}"
      write(pdf, level_text, size: 11)

      pdf.move_down 4

      if skill.competency_summary.present?
        write(pdf, skill.competency_summary, size: 10)
      end

      if skill.evidence.any?
        pdf.move_down 4
        write(pdf, 'Evidence:', size: 10, style: :bold)
        skill.evidence.each { |quote| write(pdf, "  - #{quote}", size: 10) }
      end

      if override&.assessor_notes.present?
        pdf.move_down 4
        write(pdf, 'Assessor Note:', size: 10, style: :bold)
        write(pdf, "  #{override.assessor_notes}", size: 10)
      end

      pdf.stroke { pdf.stroke_color 'CCCCCC'; pdf.horizontal_rule }
      pdf.move_down 8
    end

    def render_fit_gap_section(pdf)
      pdf.start_new_page

      write(pdf, "Fit/Gap Analysis - #{@vacancy.role_title}", size: 16, style: :bold)
      pdf.move_down 8

      comparisons = @fit_gap.skill_comparisons

      table_data = [['Skill', 'Required', 'Candidate', 'Result', 'Delta']]
      comparisons.each do |c|
        table_data << [
          comparison_value(c, 'skill_label'),
          comparison_value(c, 'expected_level') ? "L#{comparison_value(c, 'expected_level')}" : '-',
          comparison_value(c, 'candidate_level') ? "L#{comparison_value(c, 'candidate_level')}" : '-',
          RESULT_LABELS[comparison_value(c, 'result')] || comparison_value(c, 'result'),
          delta_label(comparison_value(c, 'delta'))
        ].map { |cell| pdf_safe(cell) }
      end

      pdf.table(table_data, header: true, width: pdf.bounds.width) do |t|
        t.row(0).font_style = :bold
        t.row(0).background_color = 'E5E7EB'
        t.cells.padding = [6, 8]
        t.cells.size = 10
      end

      if @fit_gap.culture_narrative.present?
        pdf.move_down 12
        write(pdf, 'Culture & Competency Fit', size: 12, style: :bold)
        pdf.move_down 4
        write(pdf, @fit_gap.culture_narrative, size: 10)
      end

      if @fit_gap.overall_narrative.present?
        pdf.move_down 8
        write(pdf, 'Overall Assessment', size: 12, style: :bold)
        pdf.move_down 4
        write(pdf, @fit_gap.overall_narrative, size: 10)
      end
    end

    def render_footer(pdf)
      pdf.number_pages 'Page <page> of <total>',
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

    def comparison_value(row, key)
      row[key] || row[key.to_sym]
    end

    def delta_label(delta)
      return '-' if delta.nil?
      delta.to_f.positive? ? "+#{delta}" : delta.to_s
    end

    def write(pdf, text, size:, style: nil)
      options = {}
      options[:style] = style if style
      pdf.font_size(size) { pdf.text pdf_safe(text), **options }
    end

    # Helvetica only accepts Windows-1252. Round-trip so Prawn receives UTF-8
    # that can still encode (override arrows, Gemini punctuation, emoji).
    def pdf_safe(value)
      value.to_s
           .encode('UTF-8', invalid: :replace, undef: :replace, replace: '?')
           .encode('Windows-1252', invalid: :replace, undef: :replace, replace: '?')
           .encode('UTF-8')
    end
  end
end
