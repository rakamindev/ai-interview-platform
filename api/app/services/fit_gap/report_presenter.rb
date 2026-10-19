# frozen_string_literal: true

module FitGap
  # The web client reads required_level. Older reports only stored
  # expected_level, so the required column rendered blank.
  module ReportPresenter
    module_function

    def comparisons(raw)
      Array(raw).map do |row|
        item = row.is_a?(Hash) ? row.each_with_object({}) { |(key, value), memo| memo[key.to_s] = value } : {}
        required = item['required_level'].nil? ? item['expected_level'] : item['required_level']
        item['required_level'] = required
        item['expected_level'] = item['expected_level'].nil? ? required : item['expected_level']
        item
      end
    end
  end
end
