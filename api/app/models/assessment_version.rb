# frozen_string_literal: true

# Immutable point-in-time snapshot of an Assessment's fields and skills,
# created on every Assessment save (see Assessment#create_assessment_version).
# Never updated or destroyed after creation.
class AssessmentVersion < ApplicationRecord
  belongs_to :assessment
end
