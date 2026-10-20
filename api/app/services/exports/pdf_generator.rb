# frozen_string_literal: true

require 'prawn'
require 'prawn/table'

# Text is transliterated to Windows-1252 by PdfGenerator#pdf_safe, so the built-in fonts are safe to use.
Prawn::Fonts::AFM.hide_m17n_warning = true

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
    EVIDENCE_GAP_MESSAGES = {
      'skills_not_assessed'  => 'Not assessed in the interview',
      'low_confidence'       => 'Low-confidence ratings not yet confirmed by an assessor',
      'interview_incomplete' => 'The interview ended before it was complete',
      'no_vacancy_skills'    => 'The vacancy defines no skills to compare against'
    }.freeze
    # Prawn's built-in fonts only cover Windows-1252; transliterate what we can, replace the rest.
    TRANSLITERATIONS = { '→' => '->', '←' => '<-', '⇒' => '=>', '✓' => 'v', '✗' => 'x', '…' => '...' }.freeze

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
      pdf.font_size(22) { pdf.text pdf_safe(@assessment.name), style: :bold }
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

      pdf.font_size(11) do
        pdf.text pdf_safe(skill.skill_label), style: :bold

        level_text = "Level: #{level_label(skill.effective_level)}"
        level_text += " (AI: #{level_label(skill.ai_level)} -> Override: #{level_label(override.override_level)})" if override
        level_text += '  |  No evidence in the interview' if skill.effective_level.nil?
        level_text += "  |  Confidence: #{CONFIDENCE_LABELS[skill.ai_confidence]}" if skill.ai_confidence
        pdf.text level_text
      end

      pdf.move_down 4

      if skill.competency_summary.present?
        pdf.font_size(10) { pdf.text pdf_safe(skill.competency_summary) }
      end

      if skill.evidence_quotes.any?
        pdf.move_down 4
        pdf.font_size(10) do
          pdf.text "Evidence:", style: :bold
          skill.evidence_quotes.each { |quote| pdf.text "  • #{pdf_safe(quote)}" }
        end
      end

      if override&.assessor_notes.present?
        pdf.move_down 4
        pdf.font_size(10) do
          pdf.text "Assessor Note:", style: :bold
          pdf.text "  #{pdf_safe(override.assessor_notes)}"
        end
      end

      pdf.move_down 4
      pdf.stroke_color 'CCCCCC'
      pdf.stroke_horizontal_rule
      pdf.stroke_color '000000'
      pdf.move_down 8
    end

    def render_fit_gap_section(pdf)
      pdf.start_new_page

      pdf.font_size(16) { pdf.text "Fit/Gap Analysis — #{pdf_safe(@vacancy.role_title)}", style: :bold }
      pdf.move_down 8

      comparisons = @fit_gap.skill_comparisons

      table_data = [['Skill', 'Required', 'Candidate', 'Result', 'Delta']]
      comparisons.each do |c|
        table_data << [
          pdf_safe(c['skill_label']),
          c['expected_level'] ? "L#{c['expected_level']}" : '—',
          c['candidate_level'] ? "L#{c['candidate_level']}" : '—',
          RESULT_LABELS[c['result']] || c['result'],
          c['delta'] ? (c['delta'] > 0 ? "+#{c['delta']}" : c['delta'].to_s) : '—'
        ]
      end

      pdf.table(table_data, header: true, width: pdf.bounds.width) do |t|
        t.row(0).font_style = :bold
        t.row(0).background_color = 'E5E7EB'
        t.cells.padding = [6, 8]
        t.cells.size = 10
      end

      if @fit_gap.insufficient_evidence?
        render_evidence_gaps(pdf)
        return
      end

      if @fit_gap.recommendation_status.nil?
        pdf.move_down 8
        pdf.font_size(9) do
          pdf.text 'Generated before evidence checks were introduced. Regenerate this report to verify the recommendation.',
                   style: :italic, color: '92400E'
        end
      end

      if @fit_gap.culture_narrative.present?
        pdf.move_down 12
        pdf.font_size(12) { pdf.text "Culture & Competency Fit", style: :bold }
        pdf.move_down 4
        pdf.font_size(10) { pdf.text pdf_safe(@fit_gap.culture_narrative) }
      end

      if @fit_gap.overall_narrative.present?
        pdf.move_down 8
        pdf.font_size(12) { pdf.text "Overall Assessment", style: :bold }
        pdf.move_down 4
        pdf.font_size(10) { pdf.text pdf_safe(@fit_gap.overall_narrative) }
      end
    end

    # The evidence gate withheld the recommendation: say why, instead of printing a verdict.
    def render_evidence_gaps(pdf)
      pdf.move_down 12
      pdf.font_size(12) { pdf.text "No recommendation: insufficient evidence", style: :bold }
      pdf.move_down 4
      pdf.font_size(10) do
        Array(@fit_gap.evidence_gaps).each do |gap|
          message = EVIDENCE_GAP_MESSAGES.fetch(gap['reason'], gap['reason'].to_s.humanize)
          skills  = Array(gap['skills'])
          pdf.text "  • #{message}#{skills.any? ? ": #{pdf_safe(skills.join(', '))}" : ''}"
        end
        pdf.move_down 4
        pdf.text 'Rate the listed skills manually or re-interview the candidate before deciding.'
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

    def level_label(level)
      LEVEL_LABELS.fetch(level, 'Not assessed')
    end

    def pdf_safe(text)
      text.to_s.gsub(Regexp.union(TRANSLITERATIONS.keys), TRANSLITERATIONS)
          .encode('Windows-1252', invalid: :replace, undef: :replace, replace: '?')
          .encode('UTF-8')
    end

    def format_duration(seconds)
      return 'N/A' unless seconds
      mins = seconds / 60
      secs = seconds % 60
      "#{mins}m #{secs}s"
    end
  end
end
