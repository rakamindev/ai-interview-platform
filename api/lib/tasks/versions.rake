# frozen_string_literal: true

namespace :versions do
  desc 'Backfill vacancy_versions/assessment_versions for pre-existing rows (idempotent)'
  task backfill: :environment do
    Vacancy.find_each do |vacancy|
      next if VacancyVersion.exists?(vacancy_id: vacancy.id)

      version = VacancyVersion.create!(
        vacancy_id: vacancy.id,
        role_title: vacancy.role_title,
        culture_dimensions: vacancy.culture_dimensions,
        competency_expectations: vacancy.competency_expectations,
        public_requirement_text: vacancy.public_requirement_text,
        skills_snapshot: vacancy.vacancy_skills.map do |s|
          { skill_id: s.skill_id, skill_label: s.skill_label, expected_level: s.expected_level }
        end,
        # Built from the vacancy's CURRENT state, not its actual history at any
        # past point in time — flagged so the UI can show that distinction.
        approximate: true
      )

      FitGapReport.where(vacancy_id: vacancy.id, vacancy_version_id: nil)
                  .update_all(vacancy_version_id: version.id)
    end

    Assessment.find_each do |assessment|
      next if AssessmentVersion.exists?(assessment_id: assessment.id)

      version = AssessmentVersion.create!(
        assessment_id: assessment.id,
        name: assessment.name,
        time_limit_min: assessment.time_limit_min,
        language: assessment.language,
        skills_snapshot: assessment.assessment_skills.map do |s|
          {
            skill_id: s.skill_id,
            skill_label: s.skill_label,
            is_custom: s.is_custom,
            scope_include: s.scope_include,
            scope_exclude: s.scope_exclude,
            l1_anchor: s.l1_anchor,
            l2_anchor: s.l2_anchor,
            l3_anchor: s.l3_anchor,
            l4_anchor: s.l4_anchor,
            l5_anchor: s.l5_anchor,
            expected_level: s.expected_level,
            display_order: s.display_order
          }
        end,
        approximate: true
      )

      Session.where(assessment_id: assessment.id, assessment_version_id: nil)
             .update_all(assessment_version_id: version.id)
    end
  end
end
