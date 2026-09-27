# frozen_string_literal: true

FactoryBot.define do
  factory :transcript_turn do
    session
    sequence(:turn_number) { |n| n }
    speaker { 'candidate' }
    text { 'I used React hooks and context for state management.' }
    audio_start_ms { 1000 }
    audio_end_ms { 4000 }
  end
end
