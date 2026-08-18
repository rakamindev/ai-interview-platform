# frozen_string_literal: true

FactoryBot.define do
  factory :cv_screening_batch do
    association :cv_screening
    tenant_id { cv_screening.tenant_id }
    vacancy_id { cv_screening.vacancy_id }
    assessment_id { cv_screening.assessment_id }
    vacancy_version_id { cv_screening.vacancy.vacancy_versions.order(created_at: :desc).first&.id }
    threshold { cv_screening.threshold }
    created_by { 1 }
  end
end
