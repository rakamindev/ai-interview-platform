# frozen_string_literal: true

module Portfolios
  module Confidence
    def self.for(coverage_map)
      return 'high' if coverage_map.state == 'covered' && coverage_map.probe_count >= 3
      return 'low' if coverage_map.state == 'initiated' || coverage_map.probe_count <= 1

      'medium'
    end
  end
end
