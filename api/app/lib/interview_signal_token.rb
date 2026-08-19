# frozen_string_literal: true

# Shared secret used to distinguish legitimate backend TIME CONTROL messages
# from candidate-supplied text during a live interview (anti prompt-injection
# defense — see Assessments::SystemPromptCompiler#coverage_guidance_section
# and AudioWebSocketMiddleware's TIME CONTROL message builders).
#
# Read from ENV so it is never persisted as part of stored prompt content —
# see F-004: the token used to be hardcoded literally inside the compiled
# system_prompt text, which meant it leaked wherever system_prompt did.
module InterviewSignalToken
  def self.value
    ENV.fetch('INTERVIEW_SIGNAL_TOKEN', 'SYS-TC-7x9k')
  end
end
