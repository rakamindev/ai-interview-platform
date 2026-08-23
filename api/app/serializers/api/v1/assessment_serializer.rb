module Api
    module V1
        class AssessmentSerializer < BaseSerializer
            LIST_ATTRIBUTES = %i[id time_limit_min].freeze

            DETAIL_ATTRIBUTES = LIST_ATTRIBUTES + %i[
                vacancy_id
                language
                system_prompt
                latest_session
                created_by
                created_at
                updated_at
            ]

            def self.list(assessment)
                assessment.attributes
                          .slice(*LIST_ATTRIBUTES.map(&:to_s))
                          .merge(
                              name: assessment.vacancy&.role_title,
                              vacancy_status: assessment.vacancy&.status,
                              session_count: assessment.sessions.count
                          )
            end

            def self.detail(assessment)
                latest = assessment.sessions.max_by(&:created_at)

                assessment.attributes
                          .slice(*DETAIL_ATTRIBUTES.map(&:to_s))
                          .merge(
                              vacancy_status: assessment.vacancy&.status,
                              name: assessment.vacancy&.role_title,
                              latest_session: latest && {
                                  id: latest.id,
                                  status: latest.status,
                                  end_reason: latest.end_reason
                              }
                          )
            end

            def self.detail_with_skills(assessment)
                # p assessment.assessment_skills

                detail(assessment).merge(
                    skills: assessment.assessment_skills.map do |s|

                        skill_taxonomy = s.skill_taxonomy
                        p skill_taxonomy
                        {
                            id: s.id,
                            skill_id: skill_taxonomy.try(:skill_id) || s.skill_label,
                            expected_level: s.expected_level,
                            skill_label: skill_taxonomy.try(:skill_label) || s.skill_label,
                            l1_anchor: s.is_custom ? s.l1_anchor : skill_taxonomy.l1_anchor,
                            l2_anchor: s.is_custom ? s.l2_anchor : skill_taxonomy.l2_anchor,
                            l3_anchor: s.is_custom ? s.l3_anchor : skill_taxonomy.l3_anchor,
                            l4_anchor: s.is_custom ? s.l4_anchor : skill_taxonomy.l4_anchor,
                            l5_anchor: s.is_custom ? s.l5_anchor : skill_taxonomy.l5_anchor,
                            is_custom: s.is_custom,
                            scope_include: s.is_custom ? s.scope_include : skill_taxonomy.scope_include,
                            scope_exclude: s.is_custom ? s.scope_exclude : skill_taxonomy.scope_exclude,
                            display_order: s.display_order
                        }
                    end
                )

                # taxonomy = assessment.skill_taxonomy
                # detail(assessment).merge(
                #     skills: assessment.skill_taxonomy.map do |s|
                #
                #         merge = {
                #             is_custom: s.is_custom,
                #             scope_include: s.scope_include,
                #             scope_exclude: s.scope_exclude,
                #             display_order: s.display_order
                #         }
                #
                #         skill(s, skill_taxonomy).merge(merge)
                #     end
                # )
            end



            # def self.skill(skill, skill_taxonomy)
            #
            #     {
            #         id: skill.id,
            #         skill_id: skill.skill_id,
            #         expected_level: skill.expected_level,
            #         skill_label: skill.skill_label,
            #         l1_anchor: skill.l1_anchor,
            #         l2_anchor: skill.l2_anchor,
            #         l3_anchor: skill.l3_anchor,
            #         l4_anchor: skill.l4_anchor,
            #         l5_anchor: skill.l5_anchor
            #     }
            # end
        end
    end
end