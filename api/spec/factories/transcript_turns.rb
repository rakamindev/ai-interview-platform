# frozen_string_literal: true

FactoryBot.define do
  factory :transcript_turn do
    association :session
    turn_number { 1 }
    speaker { 'ai' }
    text { 'Tell me about your experience with React.' }
    audio_start_ms { 0 }
    audio_end_ms { 5000 }
  end
end
