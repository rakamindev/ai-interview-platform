# frozen_string_literal: true

module Exports
  # Wording of the PDF. Only turns presenter values into text; levels,
  # confidence and results are decided by the presenters, never here.
  module PdfLabels
    NOT_ASSESSED = 'Not assessed'

    CONFIDENCE = { 'high' => 'High', 'medium' => 'Medium', 'low' => 'Low' }.freeze

    # Same wording as the portfolio screen (SkillPortfolioCard).
    NOT_ASSESSED_REASONS = {
      'not_covered' => 'Not covered in the interview. Probe this skill in the next interview.',
      'no_level_from_model' => 'The AI did not return a rating. Review the transcript or rate manually.',
      'invalid_level_from_model' => 'The AI returned an unusable rating. Review the transcript or rate manually.',
      'no_evidence' => 'No candidate quote supports a rating. Review the transcript or rate manually.'
    }.freeze

    TENTATIVE = { 'below' => 'tentatively below', 'equal' => 'tentatively matches',
                  'above' => 'tentatively above' }.freeze

    NARRATIVE_STATUS = { 'not_requested' => 'Not requested', 'generating' => 'Generating', 'complete' => 'Ready',
                         'failed' => 'Failed', 'outdated' => 'Outdated' }.freeze

    NARRATIVE_STATUS_TEXT = {
      'not_requested' => 'No AI narrative was requested. The comparison above does not depend on it.',
      'generating' => 'The AI narrative is still being written. Export again when it is ready.',
      'failed' => 'The AI narrative could not be generated. Regenerate it on the Fit/Gap page.',
      'outdated' => 'Ratings changed after this narrative was written. Regenerate it on the Fit/Gap page.'
    }.freeze

    module_function

    def level(value)
      value ? "L#{value}" : NOT_ASSESSED
    end

    def confidence(value, probe_count)
      probes = case probe_count
               when nil then 'probes not recorded'
               when 1 then '1 probe'
               else "#{probe_count} probes"
               end
      "#{CONFIDENCE.fetch(value, value)} (#{probes})"
    end

    def not_assessed_reason(reason)
      NOT_ASSESSED_REASONS.fetch(reason.to_s, NOT_ASSESSED_REASONS['not_covered'])
    end

    def reviewer(review)
      "Assessor ##{review[:actor_id]}, #{review[:at]&.utc&.strftime('%Y-%m-%d %H:%M UTC')}"
    end
  end
end
