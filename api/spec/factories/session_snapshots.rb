# frozen_string_literal: true

FactoryBot.define do
  factory :session_snapshot do
    session
    captured_at { Time.current }
    image_data { "base64imagedata" }
  end
end
