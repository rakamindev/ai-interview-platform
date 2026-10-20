# frozen_string_literal: true

module Portfolios
  class ResponseParser
    MAX_QUOTES         = 3
    MAX_QUOTE_LENGTH   = 500
    MAX_SUMMARY_LENGTH = 2_000

    class InvalidResponse < StandardError; end

    def self.normalize_label(label)
      label.to_s.strip.downcase
    end

    def initialize(response)
      @response = response
    end

    def ratings_by_label
      unless @response.is_a?(Hash) && @response['skills'].is_a?(Array)
        raise InvalidResponse, 'The AI model returned a response in an unexpected format'
      end

      @response['skills'].each_with_object({}) do |item, ratings|
        next unless item.is_a?(Hash) && item['skill_label'].is_a?(String)

        ratings[self.class.normalize_label(item['skill_label'])] = {
          level:              parse_level(item['level']),
          evidence:           parse_evidence(item['evidence']),
          competency_summary: parse_summary(item['competency_summary'])
        }
      end
    end

    private

    def parse_level(value)
      case value
      when Integer then value if (1..5).cover?(value)
      when String  then value.strip[/\AL?([1-5])\z/i, 1]&.to_i
      end
    end

    def parse_evidence(value)
      Array(value).grep(String)
                  .map(&:strip)
                  .reject(&:empty?)
                  .first(MAX_QUOTES)
                  .map { |quote| quote.truncate(MAX_QUOTE_LENGTH) }
    end

    def parse_summary(value)
      return nil unless value.is_a?(String) && value.strip.present?

      value.strip.truncate(MAX_SUMMARY_LENGTH)
    end
  end
end
