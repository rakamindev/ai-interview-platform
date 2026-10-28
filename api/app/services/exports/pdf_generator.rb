# frozen_string_literal: true

require 'prawn'
require 'prawn/table'

module Exports
  # N14 & User Note #28: Generates a professionally branded PDF export of a portfolio,
  # including official Rakamin header logo and clean styling.
  class PdfGenerator
    LEVEL_LABELS = { 1 => 'L1 (Beginner)', 2 => 'L2 (Junior)', 3 => 'L3 (Mid-level)', 4 => 'L4 (Senior)', 5 => 'L5 (Expert)' }.freeze
    LEVEL_CODES  = { 1 => 'L1', 2 => 'L2', 3 => 'L3', 4 => 'L4', 5 => 'L5' }.freeze
    CONFIDENCE_LABELS = { 'high' => 'High', 'medium' => 'Medium', 'low' => 'Low' }.freeze
    RESULT_LABELS = {
      'match'        => 'Match',
      'gap'          => 'Gap',
      'exceed'       => 'Exceeds',
      'not_assessed' => 'Not Assessed'
    }.freeze

    RAKAMIN_TEAL = '01959F'
    SLATE_DARK   = '1E293B'
    SLATE_MUTED  = '64748B'
    BORDER_LIGHT = 'E2E8F0'

    def initialize(portfolio:, vacancy: nil)
      @portfolio   = portfolio
      @vacancy     = vacancy
      @session     = portfolio.session
      @assessment  = @session.assessment
      @fit_gap     = vacancy ? FitGapReport.find_by(portfolio: portfolio, vacancy: vacancy) : nil
    end

    # Returns PDF binary string.
    def call
      Prawn::Document.new(page_size: 'A4', margin: [40, 45, 40, 45]) do |pdf|
        render_header(pdf)
        render_portfolio_section(pdf)
        render_fit_gap_section(pdf) if @fit_gap
        render_footer(pdf)
      end.render
    end

    private

    def clean(text)
      return '' if text.nil?

      str = text.to_s
      str = str.gsub("\u2022", '* ')
               .gsub("\u2192", '->')
               .gsub("\u2014", '--')
               .gsub("\u2013", '-')
               .gsub(/[\u201C\u201D]/, '"')
               .gsub(/[\u2018\u2019]/, "'")
               .gsub("\u2026", '...')
               .gsub("\u00AB", '"')
               .gsub("\u00BB", '"')

      str.encode('Windows-1252', invalid: :replace, undef: :replace, replace: '?')
         .encode('UTF-8')
    end

    def render_header(pdf)
      # Check for Rakamin Logo (Note #28)
      logo_path = Rails.root.join('public', 'rakamin-logo.png')
      if File.exist?(logo_path)
        begin
          pdf.image logo_path.to_s, width: 130
          pdf.move_down 10
        rescue StandardError => e
          Rails.logger.warn("Could not embed logo in PDF: #{e.message}")
        end
      end

      # Header title & candidate info
      pdf.fill_color RAKAMIN_TEAL
      pdf.font_size(18) { pdf.text clean(@assessment.name), style: :bold }
      pdf.fill_color SLATE_DARK
      pdf.move_down 2

      candidate_display = @session.candidate_name.presence || "Candidate ##{@session.id}"
      pdf.font_size(12) do
        pdf.text "Interview Evaluation Report -- #{clean(candidate_display)}", style: :bold
      end
      pdf.move_down 6

      pdf.fill_color SLATE_MUTED
      pdf.font_size(9) do
        pdf.text "Session ID: #{@session.id}   |   Duration: #{format_duration(@session.duration_seconds)}   |   Report Date: #{Time.current.strftime('%d %b %Y, %H:%M')}"
      end
      pdf.fill_color SLATE_DARK

      pdf.move_down 8
      pdf.stroke do
        pdf.stroke_color RAKAMIN_TEAL
        pdf.line_width 1.5
        pdf.horizontal_rule
      end
      pdf.move_down 12
    end

    def render_portfolio_section(pdf)
      pdf.fill_color SLATE_DARK
      pdf.font_size(14) { pdf.text 'Skill Assessment Summary', style: :bold }
      pdf.move_down 8

      skills = @portfolio.portfolio_skills.includes(:assessor_override)
      configured = skills.reject(&:is_discovered)
      discovered = skills.select(&:is_discovered)

      if configured.any?
        configured.each { |skill| render_skill_card(pdf, skill) }
      end

      if discovered.any?
        pdf.move_down 8
        pdf.fill_color RAKAMIN_TEAL
        pdf.font_size(12) { pdf.text 'Discovered Competencies (AI Probed)', style: :bold }
        pdf.fill_color SLATE_DARK
        pdf.move_down 6
        discovered.each { |skill| render_skill_card(pdf, skill) }
      end
    end

    def render_skill_card(pdf, skill)
      override = skill.assessor_override
      effective_level = override ? override.override_level : skill.ai_level.to_i
      ai_lvl_int = skill.ai_level.to_i

      pdf.fill_color SLATE_DARK
      pdf.font_size(11) do
        pdf.text clean(skill.skill_label), style: :bold
      end

      level_text = "Proficiency: #{LEVEL_LABELS[effective_level] || effective_level}"
      if override
        level_text += " [Assessor Override from #{LEVEL_CODES[ai_lvl_int] || ai_lvl_int}]"
      end
      level_text += "   |   Confidence: #{CONFIDENCE_LABELS[skill.ai_confidence] || skill.ai_confidence}"

      pdf.fill_color RAKAMIN_TEAL
      pdf.font_size(9) { pdf.text clean(level_text), style: :bold }
      pdf.fill_color SLATE_DARK
      pdf.move_down 4

      if skill.competency_summary.present?
        pdf.font_size(9.5) { pdf.text clean(skill.competency_summary) }
        pdf.move_down 4
      end

      if skill.evidence.any?
        pdf.font_size(9) do
          pdf.text 'Observed Signals / Transcript Evidence:', style: :bold
          skill.evidence.each { |quote| pdf.text clean("  * #{quote}") }
        end
        pdf.move_down 4
      end

      if override&.assessor_notes.present?
        pdf.font_size(9) do
          pdf.text 'Assessor Evaluation Notes:', style: :bold
          pdf.text clean("  #{override.assessor_notes}")
        end
        pdf.move_down 4
      end

      pdf.stroke do
        pdf.stroke_color BORDER_LIGHT
        pdf.line_width 0.8
        pdf.horizontal_rule
      end
      pdf.move_down 8
    end

    def render_fit_gap_section(pdf)
      pdf.start_new_page

      pdf.fill_color RAKAMIN_TEAL
      pdf.font_size(14) { pdf.text clean("Vacancy Fit/Gap Analysis -- #{@vacancy.role_title}"), style: :bold }
      pdf.fill_color SLATE_DARK
      pdf.move_down 8

      comparisons = @fit_gap.skill_comparisons

      table_data = [['Skill Requirement', 'Required Level', 'Candidate Level', 'Result', 'Delta']]
      comparisons.each do |c|
        table_data << [
          clean(c['skill_label']),
          c['expected_level'] ? "L#{c['expected_level']}" : '-',
          c['candidate_level'] ? "L#{c['candidate_level']}" : '-',
          clean(RESULT_LABELS[c['result']] || c['result']),
          c['delta'] ? (c['delta'].positive? ? "+#{c['delta']}" : c['delta'].to_s) : '-'
        ]
      end

      pdf.table(table_data, header: true, width: pdf.bounds.width) do |t|
        t.row(0).font_style = :bold
        t.row(0).background_color = 'F1F5F9'
        t.cells.padding = [6, 8]
        t.cells.size = 9
        t.cells.border_color = 'CBD5E1'
      end

      if @fit_gap.culture_narrative.present?
        pdf.move_down 12
        pdf.font_size(11) { pdf.text 'Culture & Work Environment Fit', style: :bold }
        pdf.move_down 4
        pdf.font_size(9.5) { pdf.text clean(@fit_gap.culture_narrative) }
      end

      if @fit_gap.overall_narrative.present?
        pdf.move_down 10
        pdf.font_size(11) { pdf.text 'Overall AI Recommendation', style: :bold }
        pdf.move_down 4
        pdf.font_size(9.5) { pdf.text clean(@fit_gap.overall_narrative) }
      end
    end

    def render_footer(pdf)
      pdf.number_pages 'Page <page> of <total>  --  Rakamin AI Interview Platform',
                        at:     [pdf.bounds.left, 0],
                        width:  pdf.bounds.right,
                        align:  :center,
                        size:   8,
                        color:  SLATE_MUTED
    end

    def format_duration(seconds)
      return 'N/A' unless seconds

      mins = seconds / 60
      secs = seconds % 60
      "#{mins}m #{secs}s"
    end
  end
end
