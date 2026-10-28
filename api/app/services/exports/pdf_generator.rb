
# frozen_string_literal: true

require 'prawn'
require 'prawn/table'

module Exports
  class PdfGenerator
    LEVEL_LABELS = {
      1 => 'L1',
      2 => 'L2',
      3 => 'L3',
      4 => 'L4',
      5 => 'L5'
    }.freeze

    CONFIDENCE_LABELS = {
      'high' => 'High',
      'medium' => 'Medium',
      'low' => 'Low'
    }.freeze

    RESULT_LABELS = {
      'match' => 'Match',
      'gap' => 'Gap',
      'exceed' => 'Exceeds',
      'not_assessed' => 'Not Assessed'
    }.freeze

    def initialize(portfolio:, vacancy: nil)
      @portfolio = portfolio
      @vacancy = vacancy
      @session = portfolio.session
      @assessment = @session.assessment
      @fit_gap = if vacancy
                   FitGapReport.find_by(
                     portfolio: portfolio,
                     vacancy: vacancy
                   )
                 end
    end

    def call
      Prawn::Document.new(
        page_size: 'A4',
        margin: [40, 50, 40, 50]
      ) do |pdf|
        render_header(pdf)
        render_portfolio_section(pdf)
        render_fit_gap_section(pdf) if @fit_gap
        render_footer(pdf)
      end.render
    end

    private

    def render_header(pdf)
      pdf.font_size(22) do
        pdf.text(@assessment.name.to_s, style: :bold)
      end

      pdf.move_down 4
      pdf.font_size(12) { pdf.text('Skill Portfolio Report') }
      pdf.move_down 4

      pdf.font_size(10) do
        pdf.text("Session: #{@session.id}")
        pdf.text("Duration: #{format_duration(@session.duration_seconds)}")
        pdf.text("Generated: #{Time.current.strftime('%Y-%m-%d %H:%M')}")
      end

      pdf.stroke_horizontal_rule
      pdf.move_down 10
    end

    def render_portfolio_section(pdf)
      pdf.font_size(16) do
        pdf.text('Skill Portfolio', style: :bold)
      end
      pdf.move_down 8

      skills = @portfolio.portfolio_skills
                         .includes(:assessor_override)
                         .to_a

      # Gunakan is_discovered hanya jika atribut tersebut tersedia.
      # Jika tidak tersedia, skill ditampilkan sebagai Assessed Skills.
      discovered, configured = skills.partition do |skill|
        skill.has_attribute?(:is_discovered) &&
          ActiveModel::Type::Boolean.new.cast(skill[:is_discovered])
      end

      if configured.any?
        pdf.font_size(13) do
          pdf.text('Assessed Skills', style: :bold)
        end
        pdf.move_down 6

        configured.each do |skill|
          render_skill_card(pdf, skill)
        end
      end

      if discovered.any?
        pdf.move_down 6
        pdf.font_size(13) do
          pdf.text('Discovered Skills', style: :bold)
        end
        pdf.move_down 6

        discovered.each do |skill|
          render_skill_card(pdf, skill)
        end
      end

      if skills.empty?
        pdf.font_size(10) do
          pdf.text('No skills available for this portfolio.')
        end
      end
    end

    def render_skill_card(pdf, skill)
      override = skill.assessor_override
      effective_level = override ? override.override_level : skill.ai_level

      pdf.font_size(11) do
        pdf.text(skill.skill_label.to_s, style: :bold)

        level_text = "Level: #{level_label(effective_level)}"

        if override
          level_text +=
            " (AI: #{level_label(skill.ai_level)} -> " \
            "Override: #{level_label(override.override_level)})"
        end

        confidence = CONFIDENCE_LABELS[skill.ai_confidence.to_s] ||
                     skill.ai_confidence.to_s

        level_text += "  |  Confidence: #{confidence}"
        pdf.text(level_text)
      end

      pdf.move_down 4

      if skill.competency_summary.present?
        pdf.font_size(10) do
          pdf.text(skill.competency_summary.to_s)
        end
      end

      # evidence_quotes merupakan method yang tersedia pada model.
      evidence_quotes = if skill.respond_to?(:evidence_quotes)
                          Array(skill.evidence_quotes)
                        elsif skill.has_attribute?(:evidence)
                          Array(skill[:evidence])
                        else
                          []
                        end

      evidence_quotes = evidence_quotes.compact
                                       .map(&:to_s)
                                       .reject(&:blank?)

      unless evidence_quotes.empty?
        pdf.move_down 4

        pdf.font_size(10) do
          pdf.text('Evidence:', style: :bold)

          evidence_quotes.each do |quote|
            pdf.text("  • #{quote}")
          end
        end
      end

      if override&.assessor_notes.present?
        pdf.move_down 4

        pdf.font_size(10) do
          pdf.text('Assessor Note:', style: :bold)
          pdf.text("  #{override.assessor_notes}")
        end
      end

      pdf.stroke do
        pdf.stroke_color('CCCCCC')
        pdf.horizontal_rule
      end

      pdf.move_down 8
    end

    def render_fit_gap_section(pdf)
      pdf.start_new_page

      pdf.font_size(16) do
        pdf.text(
          "Fit/Gap Analysis — #{@vacancy.role_title}",
          style: :bold
        )
      end

      pdf.move_down 8

      comparisons = Array(@fit_gap.skill_comparisons)

      table_data = [
        ['Skill', 'Required', 'Candidate', 'Result', 'Delta']
      ]

      comparisons.each do |comparison|
        comparison = comparison.with_indifferent_access

        expected_level = comparison[:expected_level]
        candidate_level = comparison[:candidate_level]
        result = comparison[:result].to_s
        delta = comparison[:delta]

        table_data << [
          comparison[:skill_label].to_s,
          expected_level.present? ? "L#{expected_level}" : '—',
          candidate_level.present? ? "L#{candidate_level}" : '—',
          RESULT_LABELS[result] || result,
          format_delta(delta)
        ]
      end

      pdf.table(
        table_data,
        header: true,
        width: pdf.bounds.width
      ) do |table|
        table.row(0).font_style = :bold
        table.row(0).background_color = 'E5E7EB'
        table.cells.padding = [6, 8]
        table.cells.size = 10
      end

      if @fit_gap.culture_narrative.present?
        pdf.move_down 12

        pdf.font_size(12) do
          pdf.text('Culture & Competency Fit', style: :bold)
        end

        pdf.move_down 4

        pdf.font_size(10) do
          pdf.text(@fit_gap.culture_narrative.to_s)
        end
      end

      if @fit_gap.overall_narrative.present?
        pdf.move_down 8

        pdf.font_size(12) do
          pdf.text('Overall Assessment', style: :bold)
        end

        pdf.move_down 4

        pdf.font_size(10) do
          pdf.text(@fit_gap.overall_narrative.to_s)
        end
      end
    end

    def render_footer(pdf)
      pdf.number_pages(
        'Page <page> of <total>',
        at: [pdf.bounds.left, 0],
        width: pdf.bounds.width,
        align: :center,
        size: 9,
        color: '999999'
      )
    end

    def level_label(level)
      LEVEL_LABELS[level.to_i] || 'N/A'
    end

    def format_delta(delta)
      return '—' if delta.nil?

      value = delta.to_i
      value.positive? ? "+#{value}" : value.to_s
    end

    def format_duration(seconds)
      return 'N/A' if seconds.nil?

      total_seconds = seconds.to_i
      minutes = total_seconds / 60
      remaining_seconds = total_seconds % 60

      "#{minutes}m #{remaining_seconds}s"
    end
  end
end
