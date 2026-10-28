# frozen_string_literal: true

task dev_sample_fitgap: :environment do
  unless Rails.env.development?
    raise "dev_sample_fitgap is only available in development"
  end

  tenant = Organization.find_by(scheme: "test-corp")
  raise "Organization with scheme 'test-corp' was not found" unless tenant

  candidate_name = "Kandidat Contoh 1"
  now = Time.current

  report = nil

  Current.using(tenant_id: tenant.id) do
    ActiveRecord::Base.transaction do
      assessment = Assessment.find_or_initialize_by(
        tenant_id: tenant.id,
        name: "DEV SAMPLE - Backend Engineer FitGap"
      )
      assessment.assign_attributes(
        created_by: 0,
        time_limit_min: 30,
        language: "id"
      )
      assessment.save!

      session = Session.find_or_initialize_by(
        tenant_id: tenant.id,
        assessment_id: assessment.id,
        candidate_name: candidate_name
      )
      session.assign_attributes(
        status: "ended",
        end_reason: "manual_assessor",
        started_at: now - 30.minutes,
        ended_at: now,
        duration_seconds: 30.minutes.to_i
      )
      session.save!

      portfolio = Portfolio.find_or_initialize_by(session_id: session.id)
      portfolio.assign_attributes(
        generation_status: "complete",
        generated_at: now,
        generation_error: nil
      )
      portfolio.save!

      portfolio_skill_data = [
        {
          skill_id: "dev-sample-ruby",
          skill_label: "Ruby on Rails",
          ai_level: 3,
          ai_confidence: "high"
        },
        {
          skill_id: "dev-sample-react",
          skill_label: "React",
          ai_level: 2,
          ai_confidence: "medium"
        },
        {
          skill_id: "dev-sample-sql",
          skill_label: "SQL",
          ai_level: 5,
          ai_confidence: "high"
        }
      ]

      portfolio_skills = portfolio_skill_data.to_h do |attributes|
        skill = PortfolioSkill.find_or_initialize_by(
          portfolio_id: portfolio.id,
          skill_id: attributes.fetch(:skill_id)
        )
        skill.assign_attributes(
          **attributes,
          portfolio_id: portfolio.id,
          is_discovered: false,
          evidence: ["DEV SAMPLE: fictional evidence for #{attributes.fetch(:skill_label)}."],
          competency_summary: "DEV SAMPLE: fictional competency summary."
        )
        skill.save!
        [attributes.fetch(:skill_id), skill]
      end

      overridden_skill = portfolio_skills.fetch("dev-sample-react")
      override = AssessorOverride.find_or_initialize_by(
        portfolio_skill_id: overridden_skill.id
      )
      override.assign_attributes(
        ai_level: overridden_skill.ai_level,
        override_level: 4,
        assessor_notes: "DEV SAMPLE: fictional assessor override.",
        overridden_by: 0
      )
      override.save!

      vacancy = Vacancy.find_or_initialize_by(
        tenant_id: tenant.id,
        role_title: "DEV SAMPLE - Backend Engineer"
      )
      vacancy.assign_attributes(
        created_by: 0,
        culture_dimensions: "DEV SAMPLE: fictional expectations.",
        competency_expectations: "DEV SAMPLE: fictional competency expectations."
      )
      vacancy.save!

      vacancy_skill_data = [
        { skill_id: "dev-sample-ruby", skill_label: "Ruby on Rails", expected_level: 3 },
        { skill_id: "dev-sample-react", skill_label: "React", expected_level: 4 },
        { skill_id: "dev-sample-sql", skill_label: "SQL", expected_level: 3 },
        { skill_id: "dev-sample-cloud", skill_label: "Cloud Security", expected_level: 2 }
      ]

      vacancy_skill_data.each do |attributes|
        skill = VacancySkill.find_or_initialize_by(
          vacancy_id: vacancy.id,
          skill_id: attributes.fetch(:skill_id)
        )
        skill.assign_attributes(**attributes, vacancy_id: vacancy.id)
        skill.save!
      end

      gemini_stub = Class.new do
        def generate_content(_prompt, temperature: 0.4)
          {
            "culture_narrative" => "DEV SAMPLE: fixed fictional culture-fit narrative.",
            "overall_narrative" => "DEV SAMPLE: fixed fictional overall narrative."
          }
        end
      end.new

      report = FitGap::Engine.new(
        portfolio: portfolio,
        vacancy: vacancy,
        gemini_client: gemini_stub
      ).call
    end
  end

  puts "DEV SAMPLE Fit/Gap records for tenant test-corp (tenant_id=#{tenant.id}):"
  puts "  Assessment ##{assessment.id}: #{assessment.name}"
  puts "  Session ##{session.id}: #{candidate_name} (#{session.status}; no candidate record)"
  puts "  Portfolio ##{portfolio.id}: #{portfolio.generation_status}"
  puts "  Vacancy ##{vacancy.id}: #{vacancy.role_title}"
  puts "  Portfolio skills:"
  portfolio_skills.each_value do |skill|
    override_text = skill.assessor_override&.override_level
    level_text = "L#{skill.ai_level}"
    level_text += " (human override L#{override_text})" if override_text
    puts "    - #{skill.skill_label}: #{level_text}"
  end
  puts "  Vacancy requirements:"
  vacancy.vacancy_skills.order(:skill_label).each do |skill|
    puts "    - #{skill.skill_label}: expected L#{skill.expected_level}"
  end
  puts "  FitGapReport ##{report.id}:"
  report.skill_comparisons.each do |comparison|
    candidate_level = comparison["candidate_level"] || "not assessed"
    puts "    - #{comparison['skill_label']}: #{comparison['result']} (candidate #{candidate_level}, required L#{comparison['expected_level']})"
  end
  puts "  Narratives use fixed DEV SAMPLE placeholders; Gemini was not called."
end
