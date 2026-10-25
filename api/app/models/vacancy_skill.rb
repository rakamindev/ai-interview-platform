# frozen_string_literal: true

class VacancySkill < ApplicationRecord
  belongs_to :vacancy

  validates :skill_label, presence: true
  validates :expected_level, numericality: { only_integer: true, in: 1..5 }

  after_commit :invalidate_fit_gap_reports

  private

  def invalidate_fit_gap_reports
    tenant_id = Vacancy.unscoped.where(id: vacancy_id).pick(:tenant_id)
    return unless tenant_id

    FitGap::RegenerationCoordinator.invalidate_vacancy!(vacancy_id:, tenant_id:)
  end
end
