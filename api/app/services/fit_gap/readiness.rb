# frozen_string_literal: true

module FitGap
  # Hiring verdict derived only from comparisons.
  #
  # Unknown evidence blocks a decision. A confident gap declines.
  # A fully covered match or exceed advances. Low confidence never advances:
  # one thin quote is not a basis for changing someone's year.
  class Readiness
    def self.call(comparisons)
      rows = Array(comparisons).map { |row| stringify(row) }
      counts = {
        'match' => rows.count { |row| row['result'] == 'match' },
        'gap' => rows.count { |row| row['result'] == 'gap' },
        'exceed' => rows.count { |row| row['result'] == 'exceed' },
        'not_assessed' => rows.count { |row| row['result'] == 'not_assessed' }
      }
      low_confidence = rows.select { |row| row['result'] != 'not_assessed' && row['confidence'].to_s == 'low' }
      unknown = rows.select { |row| row['result'] == 'not_assessed' }
      gaps = rows.select { |row| row['result'] == 'gap' && row['confidence'].to_s != 'low' }

      verdict, rationale, blocking = decide(rows, unknown, low_confidence, gaps)

      {
        'verdict' => verdict,
        'rationale' => rationale,
        'counts' => counts,
        'blocking_skills' => blocking.map { |row| row['skill_label'] },
        'low_confidence_skills' => low_confidence.map { |row| row['skill_label'] }
      }
    end

    def self.decide(rows, unknown, low_confidence, gaps)
      if rows.empty?
        return ['hold', 'No role requirements are defined, so there is nothing to decide against.', []]
      end
      if unknown.any?
        return [
          'hold',
          'One or more required skills have no usable rating. Do not advance or decline until those skills are assessed.',
          unknown
        ]
      end
      if low_confidence.any?
        return [
          'hold',
          'One or more ratings rest on low confidence. Collect more evidence before a hiring decision.',
          low_confidence
        ]
      end
      if gaps.any?
        return [
          'decline',
          'Every required skill was assessed, and at least one confident gap remains against the role bar.',
          gaps
        ]
      end

      ['advance', 'Every required skill was assessed at or above the role bar with usable confidence.', []]
    end

    def self.stringify(row)
      return {} unless row.is_a?(Hash)

      row.each_with_object({}) { |(key, value), memo| memo[key.to_s] = value }
    end
    private_class_method :decide, :stringify
  end
end
