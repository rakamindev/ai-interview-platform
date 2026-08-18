# frozen_string_literal: true

# Immutable point-in-time snapshot of a Vacancy's requirements and skills,
# created on every Vacancy save (see Vacancy#create_vacancy_version). Never
# updated or destroyed after creation.
class VacancyVersion < ApplicationRecord
  belongs_to :vacancy
end
