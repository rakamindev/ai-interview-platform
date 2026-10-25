# frozen_string_literal: true

require 'prawn'
require 'prawn/table'
require 'ostruct'

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

    def initialize(portfolio:, vacancy: nil, snapshot: nil, fit_gap_report: nil, generated_at: nil, portfolio_version: nil)
      @portfolio       = portfolio
      @snapshot        = snapshot
      @vacancy         = vacancy
      @session         = portfolio.session
      @assessment      = @session.assessment
      @generated_at    = generated_at || Time.current
      @portfolio_version = portfolio_version
      @fit_gap         = fit_gap_report || (vacancy ? FitGapReport.find_by(portfolio: portfolio, vacancy: vacancy, portfolio_revision_id: nil) : nil)
    end

    # Returns PDF binary string.
    def call
      Prawn::Document.new(page_size: 'A4', margin: [40, 50, 40, 50]) do |pdf|
        @unicode_font_available = configure_font(pdf)
        render_header(pdf)
        render_portfolio_section(pdf)
        render_fit_gap_section(pdf) if @fit_gap
        render_footer(pdf)
      end.render
    end

    private

    def render_header(pdf)
      pdf.font_size(22) { pdf_text(pdf, @assessment.name, style: :bold) }
      pdf.move_down 4
      pdf.font_size(12) { pdf_text(pdf, "Skill Portfolio Report") }
      pdf.move_down 4

      pdf.font_size(10) do
        pdf_text(pdf, "Session: #{@session.id}")
        pdf_text(pdf, "Duration: #{format_duration(@session.duration_seconds)}")
        pdf_text(pdf, "Generated: #{@generated_at.strftime('%Y-%m-%d %H:%M')}")
        pdf_text(pdf, "Portfolio version: #{@portfolio_version || 'current'}")
      end

      pdf.stroke_horizontal_rule
      pdf.move_down 10
    end

    def render_portfolio_section(pdf)
      pdf.font_size(16) { pdf_text(pdf, "Skill Portfolio", style: :bold) }
      pdf.move_down 8

      skills = snapshot_skills
      configured = skills.reject(&:is_discovered)
      discovered = skills.select(&:is_discovered)

      if configured.any?
        pdf.font_size(13) { pdf_text(pdf, "Assessed Skills", style: :bold) }
        pdf.move_down 6
        configured.each { |skill| render_skill_card(pdf, skill) }
      end

      if discovered.any?
        pdf.move_down 6
        pdf.font_size(13) { pdf_text(pdf, "Discovered Skills", style: :bold) }
        pdf.move_down 6
        discovered.each { |skill| render_skill_card(pdf, skill) }
      end
    end

    def snapshot_skills
      return @portfolio.portfolio_skills.includes(:assessor_override) unless @snapshot

      overrides = Array(@snapshot['overrides'] || @snapshot[:overrides]).index_by do |override|
        override['portfolio_skill_id'] || override[:portfolio_skill_id]
      end

      Array(@snapshot['skills'] || @snapshot[:skills]).map do |skill|
        skill_id = skill['id'] || skill[:id]
        override = overrides[skill_id]
        OpenStruct.new(
          skill_label:        skill['skill_label'] || skill[:skill_label],
          is_discovered:      skill['is_discovered'] || skill[:is_discovered],
          ai_level:           skill['ai_level'] || skill[:ai_level],
          ai_confidence:      skill['ai_confidence'] || skill[:ai_confidence],
          evidence:           skill['evidence'] || skill[:evidence] || [],
          competency_summary: skill['competency_summary'] || skill[:competency_summary],
          assessor_override:  override && OpenStruct.new(
            override_level:  override['override_level'] || override[:override_level],
            assessor_notes:  override['assessor_notes'] || override[:assessor_notes]
          )
        )
      end
    end

    def render_skill_card(pdf, skill)
      override = skill.assessor_override
      effective_level = override ? override.override_level : skill.ai_level

      pdf.font_size(11) do
        pdf_text(pdf, skill.skill_label, style: :bold)

        level_text = "Level: #{LEVEL_LABELS[effective_level]}"
        level_text += " (AI: #{LEVEL_LABELS[skill.ai_level]} -> Override: #{LEVEL_LABELS[override.override_level]})" if override
        level_text += "  |  Confidence: #{CONFIDENCE_LABELS[skill.ai_confidence] || skill.ai_confidence}"
        pdf_text(pdf, level_text)
      end

      pdf.move_down 4

      if skill.competency_summary.present?
        pdf.font_size(10) { pdf_text(pdf, skill.competency_summary) }
      end

      if skill.evidence.any?
        pdf.move_down 4
        pdf.font_size(10) do
          pdf_text(pdf, "Evidence:", style: :bold)
          skill.evidence.each { |quote| pdf_text(pdf, "  * #{quote}") }
        end
      end

      if override&.assessor_notes.present?
        pdf.move_down 4
        pdf.font_size(10) do
          pdf_text(pdf, "Assessor Note:", style: :bold)
          pdf_text(pdf, "  #{override.assessor_notes}")
        end
      end

      pdf.stroke { pdf.stroke_color 'CCCCCC'; pdf.horizontal_rule }
      pdf.move_down 8
    end

    def render_fit_gap_section(pdf)
      pdf.start_new_page

      fit_gap_title = "Fit/Gap Analysis - #{@vacancy.role_title}"
      pdf.font_size(16) { pdf_text(pdf, fit_gap_title, style: :bold) }
      pdf.move_down 8

      comparisons = @fit_gap.skill_comparisons

      table_data = [['Skill', 'Required', 'Candidate', 'Result', 'Delta']]
      comparisons.each do |c|
        table_data << [
          pdf_value(c['skill_label']),
          c['expected_level'] ? "L#{c['expected_level']}" : '-',
          c['candidate_level'] ? "#{override_applied?(c) ? '✏️ ' : ''}L#{c['candidate_level']}" : '-',
          pdf_value(RESULT_LABELS[c['result']] || c['result']),
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
        pdf.font_size(12) { pdf_text(pdf, "Culture & Competency Fit", style: :bold) }
        pdf.move_down 4
        pdf.font_size(10) { pdf_text(pdf, @fit_gap.culture_narrative) }
      end

      if @fit_gap.overall_narrative.present?
        pdf.move_down 8
        pdf.font_size(12) { pdf_text(pdf, "Overall Assessment", style: :bold) }
        pdf.move_down 4
        pdf.font_size(10) { pdf_text(pdf, @fit_gap.overall_narrative) }
      end
    end

    def override_applied?(comparison)
      return true if comparison['is_override']

      labels = if @snapshot
                 skills = Array(@snapshot['skills'] || @snapshot[:skills])
                 skill_labels_by_id = skills.index_by { |skill| skill['id'] || skill[:id] }
                 override_ids = Array(@snapshot['overrides'] || @snapshot[:overrides]).map do |override|
                   override['portfolio_skill_id'] || override[:portfolio_skill_id]
                 end
                 override_ids.filter_map { |skill_id| skill_labels_by_id[skill_id]&.then { |skill| skill['skill_label'] || skill[:skill_label] } }
               else
                 @portfolio.portfolio_skills.includes(:assessor_override).filter_map do |skill|
                   skill.skill_label if skill.assessor_override.present?
                 end
               end

      labels.include?(comparison['skill_label'])
    end

    def configure_font(pdf)
      regular = find_font('DejaVuSans.ttf')
      bold = find_font('DejaVuSans-Bold.ttf')
      return false unless regular && bold

      pdf.font_families.update(
        'DejaVu Sans' => { normal: regular, bold: bold }
      )
      pdf.font('DejaVu Sans')
      true
    end

    def find_font(filename)
      font_dirs = [
        ENV['PDF_FONT_DIR'],
        Rails.root.join('vendor', 'fonts').to_s,
        '/usr/share/fonts/truetype/dejavu'
      ].compact

      font_dirs.map { |dir| File.join(dir, filename) }.find { |path| File.file?(path) }
    end

    def pdf_text(pdf, value, **options)
      pdf.text(pdf_value(value), **options)
    end

    def pdf_value(value)
      text = value.to_s.encode(Encoding::UTF_8, invalid: :replace, undef: :replace)
      return text if @unicode_font_available

      text
        .tr('—–→←', '--><-')
        .gsub('•', '*')
        .unicode_normalize(:nfkd)
        .encode(Encoding::US_ASCII, invalid: :replace, undef: :replace, replace: '?')
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
