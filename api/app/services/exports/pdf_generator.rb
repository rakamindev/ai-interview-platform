# frozen_string_literal: true

require 'prawn'

module Exports
  # N14: Generates a PDF export of a portfolio, optionally including a fit/gap report.
  # Returns the PDF as a binary string.
  #
  # The PDF is the official decision document (Q4), so it only prints what
  # the shared presenters say (Portfolios::SkillPresenter and
  # FitGap::ReportPresenter), the same data the API and the screens use.
  class PdfGenerator
    include PdfLabels

    LEGACY_BANNER = 'Legacy portfolio: generated before ratings were validated. Some levels may come from ' \
                    'an unchecked AI rating. Regenerate the portfolio or review every skill before relying on it.'
    LOW_CONFIDENCE_NOTE = 'Only briefly explored. Not counted toward fit until an assessor reviews it.'
    REPLACED_NOTE = 'Some characters were replaced for printing. The original text is shown in the web report.'

    def initialize(portfolio:, vacancy: nil)
      @portfolio   = portfolio
      @vacancy     = vacancy
      @session     = portfolio.session
      @assessment  = @session.assessment
    end

    # Returns PDF binary string.
    def call
      Prawn::Document.new(page_size: 'A4', margin: [40, 50, 40, 50]) do |pdf|
        canvas = PdfCanvas.new(pdf)
        render_header(canvas)
        render_portfolio_section(canvas)
        PdfFitGapSection.new(canvas, fit_gap_report).render(@vacancy.role_title) if @vacancy
        render_replaced_note(canvas) if canvas.replaced?
        render_footer(pdf)
      end.render
    end

    private

    def fit_gap_report
      FitGap::ReportPresenter.new(portfolio: @portfolio, vacancy: @vacancy)
    end

    def render_header(canvas)
      canvas.text(@assessment.name, size: 20, style: :bold)
      canvas.text('Skill Portfolio Report', size: 12)
      canvas.pdf.move_down 4
      canvas.text("Portfolio: #{@portfolio.id}  |  Session: #{@session.id}  |  " \
                  "Duration: #{format_duration(@session.duration_seconds)}", size: 9)
      canvas.text("Generated: #{Time.current.utc.strftime('%Y-%m-%d %H:%M UTC')}", size: 9)
      render_legacy_banner(canvas) unless @portfolio.ratings_validated
      canvas.pdf.stroke_horizontal_rule
      canvas.pdf.move_down 10
    end

    def render_legacy_banner(canvas)
      canvas.pdf.move_down 6
      canvas.text(LEGACY_BANNER, size: 10, style: :bold, color: '9A3412')
      canvas.pdf.move_down 6
    end

    def render_portfolio_section(canvas)
      canvas.heading('Skill Portfolio', size: 16)

      skills = @portfolio.portfolio_skills.includes(:assessor_override, :override_events).order(:id).to_a
      return canvas.text('This portfolio has no skills.') if skills.empty?

      configured, discovered = skills.partition { |skill| !skill.is_discovered }
      render_skill_group(canvas, 'Configured skills', configured)
      render_skill_group(canvas, 'Discovered skills', discovered)
    end

    def render_skill_group(canvas, title, skills)
      return if skills.empty?

      canvas.pdf.move_down 4
      canvas.heading(title)
      skills.each { |skill| render_skill_card(canvas, skill, Portfolios::SkillPresenter.new(skill)) }
    end

    def render_skill_card(canvas, skill, view)
      canvas.text(skill.skill_label, size: 11, style: :bold)
      canvas.text("Level: #{level(view.effective_level)}", size: 11)
      render_rating_source(canvas, skill, view)
      render_review(canvas, view.review) if view.review

      canvas.text(skill.competency_summary) if skill.competency_summary.present?
      render_evidence(canvas, skill.evidence_quotes)
      render_separator(canvas.pdf)
    end

    def render_separator(pdf)
      pdf.stroke do
        pdf.stroke_color 'CCCCCC'
        pdf.horizontal_rule
      end
      pdf.move_down 8
    end

    def render_rating_source(canvas, skill, view)
      return canvas.text(not_assessed_reason(skill.not_assessed_reason)) if view.effective_level.nil?

      canvas.text(source_text(view))
      canvas.text("Confidence: #{confidence(view.confidence, skill.probe_count)}") if view.confidence
      canvas.text(LOW_CONFIDENCE_NOTE) if view.confidence == 'low' && !view.human_reviewed?
    end

    def source_text(view)
      case view.level_source
      when 'assessor_override' then "Assessor override. AI level: #{level(view.review[:ai_level])}"
      when 'assessor_confirmed' then "Confirmed by assessor. AI level: #{level(view.review[:ai_level])}"
      else 'Source: AI rating, not reviewed by an assessor'
      end
    end

    def render_review(canvas, review)
      canvas.text(reviewer(review))
      canvas.text("Note: #{review[:notes].presence || 'none'}")
    end

    def render_evidence(canvas, quotes)
      return if quotes.empty?

      canvas.pdf.move_down 4
      canvas.text('Evidence:', style: :bold)
      quotes.each { |quote| canvas.text("• #{quote}") }
    end

    def render_replaced_note(canvas)
      canvas.pdf.move_down 12
      canvas.text(REPLACED_NOTE, size: 9, color: '555555')
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
