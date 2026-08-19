# frozen_string_literal: true

FactoryBot.define do
  factory :cv_screening do
    transient do
      organization { create(:organization) }
    end

    tenant_id { organization.id }
    created_by { 1 }
    sequence(:name) { |n| "Screening #{n}" }
    vacancy { create(:vacancy, organization: organization, public_requirement_text: 'We are looking for a strong generalist.') }
    assessment { create(:assessment, organization: organization) }
    threshold { 70 }
  end
end
