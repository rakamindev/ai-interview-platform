# frozen_string_literal: true

FactoryBot.define do
  factory :transcript_turn do
    session
    sequence(:turn_number)
    speaker { 'ai' }
    text { 'Walk me through a project you are proud of.' }
  end
end
