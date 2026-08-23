# frozen_string_literal: true

# Single source of truth for Vacancy JSON shape.
class VacancySerializer
  # taxonomy_map: { skill_id => SkillTaxonomy } preloaded once to avoid N+1.
  def initialize(vacancy, with_skills: false, taxonomy_map: nil)
    @vacancy      = vacancy
    @with_skills  = with_skills
    @taxonomy_map = taxonomy_map
  end

  def as_json(**)
    base = {
      id:                      vacancy.id,
      role_title:              vacancy.role_title,
      culture_dimensions:      vacancy.culture_dimensions,
      competency_expectations: vacancy.competency_expectations,
      created_by:              vacancy.created_by,
      created_at:              vacancy.created_at,
      updated_at:              vacancy.updated_at
    }

    return base.merge(skills: skills_json) if with_skills?

    base
  end

  private

  attr_reader :vacancy, :taxonomy_map

  def with_skills?
    @with_skills
  end

  def taxonomy_map
    @taxonomy_map
  end

  def default_taxonomy_map
    skill_ids = vacancy.vacancy_skills.filter_map(&:skill_id).uniq
    SkillTaxonomy.where(skill_id: skill_ids).index_by(&:skill_id)
  end

  def skills_json
    # One taxonomy lookup total — never per skill.
    map = taxonomy_map || default_taxonomy_map
    vacancy.vacancy_skills.map do |s|
      taxonomy = map[s.skill_id]

      {
        id:             s.id,
        skill_id:       s.skill_id,
        skill_label:    s.skill_label,
        expected_level: s.expected_level,
        l1_anchor:      taxonomy&.l1_anchor,
        l2_anchor:      taxonomy&.l2_anchor,
        l3_anchor:      taxonomy&.l3_anchor,
        l4_anchor:      taxonomy&.l4_anchor,
        l5_anchor:      taxonomy&.l5_anchor
      }
    end
  end
end
