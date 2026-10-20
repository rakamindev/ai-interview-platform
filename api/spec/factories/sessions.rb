# frozen_string_literal: true

FactoryBot.define do
  factory :session do
    # The assessment must share the session's tenant. candidate_info looks the
    # assessment up scoped by session.tenant_id, so a session pointing at an
    # assessment from another tenant is not merely inconsistent — it 404s.
    tenant_id   { create(:organization).id }
    assessment  { create(:assessment, tenant_id: tenant_id) }
    candidate_name { 'Test Candidate' }
    status { 'pending' }

    trait :active do
      status { 'active' }
      started_at { Time.current }
    end

    trait :ended do
      status { 'ended' }
      started_at { 40.minutes.ago }
      ended_at { Time.current }
      end_reason { 'all_covered' }
    end
  end

  factory :transcript_turn do
    session
    sequence(:turn_number) { |n| n }
    speaker { 'candidate' }
    text { 'An answer about the work.' }

    trait :from_ai do
      speaker { 'ai' }
      text { 'A follow-up question.' }
    end
  end

  factory :coverage_map do
    session
    sequence(:skill_label) { |n| "Skill #{n}" }
    state { 'not_yet' }
    probe_count { 0 }
    is_discovered { false }

    trait :covered do
      state { 'covered' }
      probe_count { 3 }
    end

    trait :discovered do
      is_discovered { true }
    end
  end
end