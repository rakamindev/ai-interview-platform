# frozen_string_literal: true

require 'prawn'
require 'prawn/table'

module Exports
    # N14: Generates a PDF export of a portfolio, optionally including a fit/gap report.
    # Returns the PDF as a binary string.
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
            @fit_gap = vacancy ? FitGapReport.find_by(
                portfolio: portfolio,
                vacancy: vacancy
            ) : nil
        end

        # Returns PDF binary string.
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
            pdf.font_size(10) do
                pdf.text Current.organization.name.to_s, style: :bold
            end

            pdf.font_size(22) do
                pdf.text @assessment.name.to_s, style: :bold
            end

            pdf.move_down 4

            pdf.font_size(12) do
                pdf.text 'Skill Portfolio Report'
            end

            pdf.move_down 4

            pdf.font_size(10) do
                pdf.text "Session: #{@session.id}"
                pdf.text "Candidate: #{@session.candidate_name}"
                pdf.text "Duration: #{format_duration(@session.duration_seconds)}"
                pdf.text(
                    "Generated: #{Time.current.in_time_zone('Asia/Jakarta').strftime('%d-%m-%Y %H:%M')}"
                )
            end

            pdf.stroke_horizontal_rule
            pdf.move_down 10
        end

        def render_portfolio_section(pdf)
            pdf.font_size(16) do
                pdf.text 'Skill Portfolio', style: :bold
            end

            pdf.move_down 8

            skills = @portfolio.portfolio_skills.includes(:assessor_override)

            configured = skills.reject(&:is_discovered)
            discovered = skills.select(&:is_discovered)

            if configured.any?
                pdf.font_size(13) do
                    pdf.text 'Assessed Skills', style: :bold
                end

                pdf.move_down 6

                configured.each do |skill|
                    render_skill_card(pdf, skill)
                end
            end

            return unless discovered.any?

            pdf.move_down 6

            pdf.font_size(13) do
                pdf.text 'Discovered Skills', style: :bold
            end

            pdf.move_down 6

            discovered.each do |skill|
                render_skill_card(pdf, skill)
            end
        end

        def render_skill_card(pdf, skill)
            override = skill.assessor_override

            effective_level = override ? override.override_level : skill.ai_level

            pdf.font_size(11) do
                pdf.text skill.skill_taxonomy.skill_label.to_s, style: :bold

                level_text = "Level: #{LEVEL_LABELS[effective_level]}"

                if override
                    level_text +=(
                        " (AI: #{LEVEL_LABELS[skill.ai_level]} " \
            "-> Override: #{LEVEL_LABELS[override.override_level]})"
                    )
                end

                confidence =
                    CONFIDENCE_LABELS[skill.ai_confidence] || skill.ai_confidence

                level_text += "  |  Confidence: #{confidence}"

                pdf.text level_text
            end

            if skill.competency_summary.present?
                pdf.move_down 4

                pdf.font_size(10) do
                    pdf.text skill.competency_summary.to_s
                end
            end

            if skill.evidence.any?
                pdf.move_down 4

                pdf.font_size(10) do
                    pdf.text 'Evidence:', style: :bold

                    skill.evidence.each do |quote|
                        pdf.text "  - #{quote}"
                    end
                end
            end

            if override&.assessor_notes.present?
                pdf.move_down 4

                pdf.font_size(10) do
                    pdf.text 'Assessor Note:', style: :bold
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

            pdf.font_size(16) do
                pdf.text(
                    "Fit/Gap Analysis - #{@vacancy.role_title}",
                    style: :bold
                )
            end

            pdf.move_down 8

            comparisons = @fit_gap.skill_comparisons

            table_data = [
                %w[Skill Required Candidate Result Delta]
            ]

            comparisons.each do |comparison|
                delta =
                    if comparison['delta']
                        comparison['delta'].positive? ?
                            "+#{comparison['delta']}" :
                            comparison['delta'].to_s
                    else
                        '-'
                    end

                table_data << [
                    comparison['skill_label'],
                    comparison['expected_level'] ?
                        "L#{comparison['expected_level']}" :
                        '-',
                    comparison['candidate_level'] ?
                        "L#{comparison['candidate_level']}" :
                        '-',
                    RESULT_LABELS[comparison['result']] || comparison['result'],
                    delta
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
                    pdf.text 'Culture & Competency Fit', style: :bold
                end

                pdf.move_down 4

                pdf.font_size(10) do
                    pdf.text @fit_gap.culture_narrative.to_s
                end
            end

            return unless @fit_gap.overall_narrative.present?

            pdf.move_down 8

            pdf.font_size(12) do
                pdf.text 'Overall Assessment', style: :bold
            end

            pdf.move_down 4

            pdf.font_size(10) do
                pdf.text @fit_gap.overall_narrative.to_s
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

        def format_duration(seconds)
            return 'N/A' unless seconds

            mins = seconds / 60
            secs = seconds % 60

            "#{mins}m #{secs}s"
        end
    end
end