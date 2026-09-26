# frozen_string_literal: true

module Portfolios
  # The one sentence that says what a report rests on, in the design's words:
  #   "This report covers 3 of 5 skills. The interview ran 38 minutes and
  #    ended normally. 64 turns were captured."
  # It reads the presenter's summary, so it never counts anything itself.
  class HonestySentence
    ENDINGS = {
      'all_covered'      => 'ended normally',
      'time_ceiling'     => 'stopped at the time limit',
      'manual_candidate' => 'ended early (the candidate ended it)',
      'manual_assessor'  => 'ended early (an assessor ended it)',
      'error'            => 'ended early (a connection error on our side)'
    }.freeze

    def initialize(summary)
      @summary = summary
    end

    def sentence
      rated = @summary[:assessed].to_i + @summary[:thin_evidence].to_i
      interview = [(ran if @summary[:duration_seconds]), ENDINGS[@summary[:end_reason]]].compact

      [
        "This report covers #{rated} of #{@summary[:total_skills]} skills.",
        ("The interview #{interview.join(' and ')}." if interview.any?),
        "#{pluralize(@summary[:turns].to_i, 'turn was', 'turns were')} captured."
      ].compact.join(' ')
    end

    # "1 assessed · 1 needs a human look · 1 not assessed". A zero is hidden,
    # except "not assessed": leaving it out would be a claim too.
    def counts
      assessed, thin, not_assessed, unavailable =
        @summary.values_at(:assessed, :thin_evidence, :not_assessed, :unavailable).map(&:to_i)

      [
        ("#{assessed} assessed" if assessed.positive?),
        ("#{thin} #{thin == 1 ? 'needs' : 'need'} a human look" if thin.positive?),
        "#{not_assessed} not assessed",
        ("#{unavailable} could not be evaluated" if unavailable.positive?)
      ].compact.join(' · ')
    end

    private

    def ran
      seconds = @summary[:duration_seconds].to_i
      return "ran #{pluralize(seconds, 'second', 'seconds')}" if seconds < 60

      "ran #{pluralize((seconds / 60.0).round, 'minute', 'minutes')}"
    end

    def pluralize(count, one, many)
      "#{count} #{count == 1 ? one : many}"
    end
  end
end
