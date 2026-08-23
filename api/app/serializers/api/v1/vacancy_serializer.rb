module Api
    module V1
        class VacancySerializer < BaseSerializer
            LIST_ATTRIBUTES = %i[id role_title status].freeze

            DETAIL_ATTRIBUTES = LIST_ATTRIBUTES + %i[
                culture_dimensions
                competency_expectations
                created_by
                created_at
                updated_at
            ].freeze

            def self.list(vacancy)
                vacancy.attributes.slice(*LIST_ATTRIBUTES.map(&:to_s))
            end

            def self.detail(vacancy)
                vacancy.attributes.slice(*DETAIL_ATTRIBUTES.map(&:to_s))
            end

            def self.detail_with_skills(vacancy)
                detail(vacancy).merge(
                    skills: vacancy.vacancy_skills.map do |vacancy_skill|
                        {
                            id: vacancy_skill.id,
                            skill_id: vacancy_skill.skill_taxonomy.skill_id,
                            skill_label: vacancy_skill.skill_taxonomy.skill_label,
                            expected_level: vacancy_skill.expected_level,
                            scope_include: vacancy_skill.skill_taxonomy.scope_include,
                            scope_exclude: vacancy_skill.skill_taxonomy.scope_exclude,
                            l1_anchor: vacancy_skill.skill_taxonomy.l1_anchor,
                            l2_anchor: vacancy_skill.skill_taxonomy.l2_anchor,
                            l3_anchor: vacancy_skill.skill_taxonomy.l3_anchor,
                            l4_anchor: vacancy_skill.skill_taxonomy.l4_anchor,
                            l5_anchor: vacancy_skill.skill_taxonomy.l5_anchor
                        }
                    end
                )
            end


        end
    end
end
