# frozen_string_literal: true

require 'prawn'
require 'prawn/table'

Prawn::Fonts::AFM.hide_m17n_warning = true if defined?(Prawn::Fonts::AFM)

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

    # Universal transliteration from common UTF-8 punctuation and symbols to Windows-1252/ASCII equivalents.
    UNICODE_REPLACEMENTS = {
      '→' => '->',
      '←' => '<-',
      '↔' => '<->',
      '•' => '-',
      '–' => '-',      # en-dash
      '—' => '-',      # em-dash
      '―' => '-',      # horizontal bar
      '“' => '"',
      '”' => '"',
      '‘' => "'",
      '’' => "'",
      '…' => '...',
      '✓' => '[v]',
      '✔' => '[v]',
      '✕' => '[x]',
      '✖' => '[x]',
      '✅' => '[Match]',
      '✏' => '[Override]',
      "\u00A0" => ' ', # non-breaking space
      "\u200B" => ''   # zero-width space
    }.freeze

    def self.clean_str(text)
      return '' if text.nil?

      str = text.to_s
      UNICODE_REPLACEMENTS.each do |target, replacement|
        str = str.gsub(target, replacement)
      end

      # Transcode to Windows-1252, replacing any unhandled glyph with '?'
      str.encode('Windows-1252', invalid: :replace, undef: :replace, replace: '?')
    end

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

    def clean_str(text)
      self.class.clean_str(text)
    end

    private

    def render_header(pdf)
      assessment_name = clean_str(@assessment.name.presence || 'Skills Assessment')
      candidate_title = clean_str(@session.candidate_name.presence || "Candidate ##{@session.id}")

      pdf.font_size(20) { pdf.text assessment_name, style: :bold }
      pdf.move_down 3
      pdf.font_size(12) { pdf.text "Skill Portfolio Report — #{candidate_title}" }
      pdf.move_down 6

      pdf.font_size(10) do
        pdf.text clean_str("Candidate: #{candidate_title}")
        pdf.text clean_str("Session ID: #{@session.id}")
        pdf.text clean_str("Duration: #{format_duration(@session.duration_seconds)}")
        pdf.text clean_str("Generated: #{Time.current.strftime('%Y-%m-%d %H:%M')}")
      end

      pdf.move_down 6
      pdf.stroke_horizontal_rule
      pdf.move_down 10
    end

    def render_portfolio_section(pdf)
      pdf.font_size(15) { pdf.text clean_str("Skill Portfolio"), style: :bold }
      pdf.move_down 8

      skills = @portfolio.portfolio_skills.includes(:assessor_override)
      configured = skills.reject(&:is_discovered)
      discovered = skills.select(&:is_discovered)

      if configured.any?
        pdf.font_size(12) { pdf.text clean_str("Assessed Skills"), style: :bold }
        pdf.move_down 6
        configured.each { |skill| render_skill_card(pdf, skill) }
      end

      if discovered.any?
        pdf.move_down 6
        pdf.font_size(12) { pdf.text clean_str("Discovered Skills"), style: :bold }
        pdf.move_down 6
        discovered.each { |skill| render_skill_card(pdf, skill) }
      end
    end

    def render_skill_card(pdf, skill)
      override = skill.assessor_override
      effective_level = override ? override.override_level : skill.ai_level

      pdf.font_size(11) do
        pdf.text clean_str(skill.skill_label), style: :bold

        level_text = "Level: #{LEVEL_LABELS[effective_level] || "L#{effective_level}"}"
        if override
          level_text += " (AI: #{LEVEL_LABELS[skill.ai_level]} -> Override: #{LEVEL_LABELS[override.override_level]})"
        end
        level_text += "  |  Confidence: #{CONFIDENCE_LABELS[skill.ai_confidence] || skill.ai_confidence}"
        pdf.text clean_str(level_text)
      end

      pdf.move_down 4

      if skill.competency_summary.present?
        pdf.font_size(10) { pdf.text clean_str(skill.competency_summary) }
      end

      if skill.evidence_quotes.any?
        pdf.move_down 4
        pdf.font_size(10) do
          pdf.text clean_str("Evidence:"), style: :bold
          skill.evidence_quotes.each { |quote| pdf.text clean_str("  - #{quote}") }
        end
      end

      if override&.assessor_notes.present?
        pdf.move_down 4
        pdf.font_size(10) do
          pdf.text clean_str("Assessor Note:"), style: :bold
          pdf.text clean_str("  #{override.assessor_notes}")
        end
      end

      pdf.move_down 4
      pdf.stroke { pdf.stroke_color 'CCCCCC'; pdf.horizontal_rule }
      pdf.move_down 8
    end

    def render_fit_gap_section(pdf)
      pdf.start_new_page

      role_title = clean_str(@vacancy.role_title.presence || 'Role')
      pdf.font_size(15) { pdf.text clean_str("Fit/Gap Analysis - #{role_title}"), style: :bold }
      pdf.move_down 8

      comparisons = @fit_gap.skill_comparisons

      table_data = [['Skill', 'Required', 'Candidate', 'Result', 'Delta']]
      comparisons.each do |c|
        table_data << [
          clean_str(c['skill_label']),
          clean_str(c['expected_level'] ? "L#{c['expected_level']}" : '-'),
          clean_str(c['candidate_level'] ? "L#{c['candidate_level']}" : '-'),
          clean_str(RESULT_LABELS[c['result']] || c['result']),
          clean_str(c['delta'] ? (c['delta'].to_i > 0 ? "+#{c['delta']}" : c['delta'].to_s) : '-')
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
        pdf.font_size(12) { pdf.text clean_str("Culture & Competency Fit"), style: :bold }
        pdf.move_down 4
        pdf.font_size(10) { pdf.text clean_str(@fit_gap.culture_narrative) }
      end

      if @fit_gap.overall_narrative.present?
        pdf.move_down 8
        pdf.font_size(12) { pdf.text clean_str("Overall Assessment"), style: :bold }
        pdf.move_down 4
        pdf.font_size(10) { pdf.text clean_str(@fit_gap.overall_narrative) }
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
