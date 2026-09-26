# frozen_string_literal: true

require 'prawn'
require 'prawn/table'

# We replace what the built-in font can't draw (see #printable), so Prawn's
# warning about international text would only be noise in the logs.
Prawn::Fonts::AFM.hide_m17n_warning = true

module Exports
  # N14: Generates a PDF export of a portfolio, optionally including a fit/gap report.
  # Returns the PDF as a binary string.
  class PdfGenerator
    CONFIDENCE_LABELS = { 'high' => 'High', 'medium' => 'Medium', 'low' => 'Low' }.freeze
    RESULT_LABELS = {
      'match'        => 'Match',
      'gap'          => 'Gap',
      'exceed'       => 'Exceeds',
      'not_assessed' => 'Not assessed'
    }.freeze

    # The design's words for a skill without a level, and for thin evidence.
    ABSENCE = {
      'not_assessed' => 'Not assessed. The interview did not reach this skill, so no level is given.',
      'unavailable'  => "Could not be evaluated. The AI's answer for this skill couldn't be used, so no level " \
                        'is shown. This is a system problem, not a judgement of the candidate.'
    }.freeze
    CAVEATS = {
      'low_probe_count' => 'Needs a human look. One probe is not enough to confirm a level. ' \
                           'Treat it as a lead, not a finding.',
      'auto_advanced'   => 'Needs a human look. Coverage was advanced automatically, not observed in ' \
                           'conversation. Check the transcript before relying on it.'
    }.freeze

    def initialize(portfolio:, vacancy: nil)
      @portfolio   = portfolio
      @vacancy     = vacancy
      @session     = portfolio.session
      @assessment  = @session.assessment
      @fit_gap     = vacancy ? FitGapReport.find_by(portfolio: portfolio, vacancy: vacancy) : nil
      # The same data the results page reads, so the PDF can't say more than the page.
      @report      = Portfolios::ReportPresenter.new(portfolio).as_json
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
      pdf.move_down 8

      # What the report rests on comes first, before any rating.
      honesty = Portfolios::HonestySentence.new(@report[:summary])
      write(pdf, honesty.sentence, size: 11)
      write(pdf, honesty.counts, size: 10, color: '555555')

      pdf.move_down 6
      pdf.stroke_horizontal_rule
      pdf.move_down 10
    end

    def render_portfolio_section(pdf)
      write(pdf, "Skill Portfolio", size: 16, style: :bold)
      pdf.move_down 8

      overrides = @report[:overrides].index_by { |override| override[:portfolio_skill_id] }
      configured, discovered = @report[:skills].partition { |skill| !skill[:is_discovered] }

      if configured.any?
        write(pdf, 'Configured skills', size: 13, style: :bold)
        pdf.move_down 6
        configured.each { |skill| render_skill_card(pdf, skill, overrides[skill[:id]]) }
      end

      if discovered.any?
        pdf.move_down 6
        write(pdf, 'Discovered skills', size: 13, style: :bold)
        pdf.move_down 6
        discovered.each { |skill| render_skill_card(pdf, skill, overrides[skill[:id]]) }
      end
    end

    def render_skill_card(pdf, skill, override)
      write(pdf, skill[:skill_label], size: 11, style: :bold)

      if skill[:ai_level]
        render_rating(pdf, skill, override)
      else
        # A skill without a level says why, and nothing else.
        write(pdf, ABSENCE[skill[:status]], size: 10)
      end

      pdf.stroke { pdf.stroke_color 'CCCCCC'; pdf.horizontal_rule }
      pdf.move_down 8
    end

    def render_rating(pdf, skill, override)
      level = override ? override[:override_level] : skill[:ai_level]
      line = "Level: L#{level}"
      line += " (the AI gave L#{skill[:ai_level]}; a reviewer changed it to L#{level})" if override
      line += "  |  Confidence: #{CONFIDENCE_LABELS[skill[:ai_confidence]]}"
      write(pdf, line, size: 11)
      write(pdf, CAVEATS[skill[:caveat]], size: 10) if skill[:caveat]
      write(pdf, "What L#{skill[:ai_level]} means here: #{skill[:anchor]}", size: 10) if skill[:anchor]
      pdf.move_down 4

      write(pdf, skill[:competency_summary], size: 10) if skill[:competency_summary].present?

      if skill[:evidence].any?
        pdf.move_down 4
        write(pdf, 'Evidence:', size: 10, style: :bold)
        skill[:evidence].each { |quote| write(pdf, "  • #{quote}", size: 10) }
      end

      return if override.nil? || override[:assessor_notes].blank?

      pdf.move_down 4
      write(pdf, 'Assessor Note:', size: 10, style: :bold)
      write(pdf, "  #{override[:assessor_notes]}", size: 10)
    end

    def render_fit_gap_section(pdf)
      pdf.start_new_page

      write(pdf, "Fit/Gap Analysis — #{@vacancy.role_title}", size: 16, style: :bold)
      pdf.move_down 8

      comparisons = @fit_gap.skill_comparisons

      table_data = [['Skill', 'Required', 'Candidate', 'Result', 'Delta']]
      comparisons.each do |c|
        table_data << [
          printable(c['skill_label']),
          c['expected_level'] ? "L#{c['expected_level']}" : '—',
          c['candidate_level'] ? "L#{c['candidate_level']}" : '—',
          result_label(c),
          c['delta'] ? (c['delta'] > 0 ? "+#{c['delta']}" : c['delta'].to_s) : '—'
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

    # An absent skill is "Not assessed" or "Could not be evaluated", never a gap.
    def result_label(comparison)
      return 'Could not be evaluated' if comparison['skill_status'] == 'unavailable'

      RESULT_LABELS[comparison['result']] || comparison['result']
    end

    def render_footer(pdf)
      pdf.number_pages "Page <page> of <total>",
                        at:     [pdf.bounds.left, 0],
                        width:  pdf.bounds.right,
                        align:  :center,
                        size:   9,
                        color:  '999999'
    end

    def write(pdf, value, size:, **options)
      pdf.font_size(size) { pdf.text(printable(value), **options) }
    end

    # The built-in PDF font only has Windows-1252 characters. Anything else
    # (an arrow, an emoji, another script) would stop the whole export, so it
    # is replaced with "?".
    def printable(value)
      value.to_s.encode('Windows-1252', invalid: :replace, undef: :replace, replace: '?').encode('UTF-8')
    end

    def format_duration(seconds)
      return 'N/A' unless seconds
      mins = seconds / 60
      secs = seconds % 60
      "#{mins}m #{secs}s"
    end
  end
end
