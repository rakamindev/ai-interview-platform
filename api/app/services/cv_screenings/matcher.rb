# frozen_string_literal: true

module CvScreenings
  # Layer 2 — only ever invoked after PublicGateChecker passes. Scores a candidate
  # against the vacancy version's PRIVATE fields (skills, competency, culture) —
  # the score and reasoning here are recruiter-facing only, never sent to a
  # candidate (see FeedbackGenerator, which structurally cannot see this output).
  class Matcher
    # status: :ok | :model_failed. score/reasoning only present when :ok.
    Result = Data.define(:status, :score, :reasoning) do
      def ok? = status == :ok
    end

    def initialize(vacancy_version:, cv_text:, gemini_client: nil)
      @vacancy_version = vacancy_version
      @cv_text = cv_text
      @gemini_client = gemini_client || Gemini::HttpClient.new(
        model: ENV.fetch('GEMINI_FLASH_MODEL', 'gemini-2.0-flash-001'), timeout: 30
      )
    end

    def call
      response = @gemini_client.generate_content(prompt, temperature: 0.2)
      data = response.is_a?(Hash) ? response : JSON.parse(response)
      score = data['score']

      return Result.new(status: :model_failed, score: nil, reasoning: nil) unless valid_score?(score)

      Result.new(status: :ok, score: score.to_i, reasoning: data['reasoning'])
    rescue StandardError => e
      Rails.logger.error("[CvScreenings::Matcher] model call failed: #{e.class}")
      Result.new(status: :model_failed, score: nil, reasoning: nil)
    end

    private

    def valid_score?(score)
      score.is_a?(Numeric) && score.between?(0, 100)
    end

    def skills_text
      @vacancy_version.skills_snapshot.map do |skill|
        "- #{skill['skill_label']} (expected level #{skill['expected_level']})"
      end.join("\n")
    end

    def prompt
      <<~PROMPT
        You are scoring a candidate CV against a role's private evaluation criteria.

        ROLE: #{@vacancy_version.role_title}
        #{@vacancy_version.culture_dimensions.presence && "CULTURE EXPECTATIONS:\n#{@vacancy_version.culture_dimensions}\n"}
        #{@vacancy_version.competency_expectations.presence && "COMPETENCY EXPECTATIONS:\n#{@vacancy_version.competency_expectations}\n"}
        SKILLS:
        #{skills_text}

        CANDIDATE CV TEXT:
        #{@cv_text}

        Score this candidate's overall fit from 0 to 100.

        OUTPUT (JSON only):
        {
          "score": 0-100,
          "reasoning": "2-3 sentences, for a recruiter, not the candidate"
        }
      PROMPT
    end
  end
end
