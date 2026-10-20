# frozen_string_literal: true

module FitGap
  class Engine
    def initialize(portfolio:, vacancy:, gemini_client: nil)
      @portfolio = portfolio
      @vacancy = vacancy
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model: ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-2.5-flash'),
        timeout: 30
      )
    end

    def call
      skill_comparisons = build_skill_comparisons
      narratives = generate_narratives(skill_comparisons)

      report = FitGapReport.find_or_initialize_by(
        portfolio_id: @portfolio.id,
        vacancy_id: @vacancy.id
      )

      report.update!(
        skill_comparisons: skill_comparisons,
        override_context: build_override_context,
        culture_narrative: narratives[:culture],
        overall_narrative: narratives[:overall],
        generated_at: Time.current
      )

      Rails.logger.info("[N13] Fit/gap report generated: portfolio=#{@portfolio.id} vacancy=#{@vacancy.id}")
      report
    end

    private

    def build_skill_comparisons
      vacancy_skills = @vacancy.vacancy_skills.index_by(&:skill_label)
      portfolio_skills = effective_portfolio_skills

      vacancy_skills.map do |label, vacancy_skill|
        portfolio_skill = find_portfolio_skill(portfolio_skills, label, vacancy_skill.skill_id)

        if portfolio_skill
          candidate_level = portfolio_skill[:effective_level]
          required_level = vacancy_skill.expected_level
          delta = candidate_level - required_level
          result = delta.zero? ? 'match' : (delta.positive? ? 'exceed' : 'gap')
        else
          candidate_level = nil
          required_level = vacancy_skill.expected_level
          delta = nil
          result = 'not_assessed'
        end

        {
          'skill_label' => label,
          'skill_id' => vacancy_skill.skill_id,
          'candidate_level' => candidate_level,
          'required_level' => required_level,
          'result' => result,
          'delta' => delta,
          'confidence' => portfolio_skill&.dig(:confidence),
          'is_override' => portfolio_skill&.dig(:overridden) || false,
          'candidate_level_source' => portfolio_skill&.dig(:overridden) ? 'assessor_override' : (portfolio_skill ? 'ai' : nil)
        }
      end
    end

    def effective_portfolio_skills
      @portfolio.portfolio_skills.includes(:assessor_override).map do |skill|
        override = skill.assessor_override
        {
          id: skill.id,
          skill_id: skill.skill_id,
          skill_label: skill.skill_label,
          ai_level: skill.ai_level,
          effective_level: override ? override.override_level : skill.ai_level,
          confidence: skill.ai_confidence,
          overridden: override.present?
        }
      end
    end

    def find_portfolio_skill(portfolio_skills, label, skill_id)
      portfolio_skills.find { |skill| skill[:skill_id] == skill_id && skill_id.present? } ||
        portfolio_skills.find { |skill| skill[:skill_label].to_s.downcase == label.to_s.downcase }
    end

    def build_override_context
      matched_ids = @vacancy.vacancy_skills.filter_map do |vacancy_skill|
        find_portfolio_skill(effective_portfolio_skills, vacancy_skill.skill_label, vacancy_skill.skill_id)&.dig(:id)
      end

      effective_portfolio_skills.filter_map do |skill|
        next unless skill[:overridden]
        next if matched_ids.include?(skill[:id])

        {
          'skill_label' => skill[:skill_label],
          'skill_id' => skill[:skill_id],
          'ai_level' => skill[:ai_level],
          'override_level' => skill[:effective_level]
        }
      end
    end

    def generate_narratives(skill_comparisons)
      gaps = skill_comparisons.select { |comparison| comparison['result'] == 'gap' }
      matches = skill_comparisons.select { |comparison| comparison['result'] == 'match' }
      exceeds = skill_comparisons.select { |comparison| comparison['result'] == 'exceed' }
      not_assessed = skill_comparisons.select { |comparison| comparison['result'] == 'not_assessed' }

      response = @gemini_client.generate_content(
        build_narrative_prompt(gaps, matches, exceeds, not_assessed),
        temperature: 0.4
      )
      data = response.is_a?(Hash) ? response : JSON.parse(response)
      { culture: data['culture_narrative'], overall: data['overall_narrative'] }
    end

    def build_narrative_prompt(gaps, matches, exceeds, not_assessed)
      <<~PROMPT
        You are writing a fit/gap analysis narrative for a candidate evaluation.
        ROLE: #{@vacancy.role_title}

        SKILL COMPARISON RESULTS:
        - Matches (#{matches.count}): #{matches.map { |c| "#{c['skill_label']} (L#{c['candidate_level']})" }.join(', ')}
        - Gaps (#{gaps.count}): #{gaps.map { |c| "#{c['skill_label']}: candidate L#{c['candidate_level']} vs required L#{c['required_level']} (delta #{c['delta']})" }.join(', ')}
        - Exceeds (#{exceeds.count}): #{exceeds.map { |c| "#{c['skill_label']}: candidate L#{c['candidate_level']} vs required L#{c['required_level']} (+#{c['delta']})" }.join(', ')}
        - Not assessed (#{not_assessed.count}): #{not_assessed.map { |c| c['skill_label'] }.join(', ')}

        Write two short narrative paragraphs as JSON only:
        {"culture_narrative":"...", "overall_narrative":"..."}
      PROMPT
    end
  end
end
