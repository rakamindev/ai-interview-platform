# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Vacancies", type: :request do
  let(:organization) { create(:organization, scheme: "test-scheme") }
  let(:tenant_id) { organization.id }

  describe "GET /api/v1/vacancies" do
    it "returns each vacancy with its skills, level and taxonomy anchors" do
      with_authorized_request do
        vacancy = create(:vacancy, tenant_id: tenant_id, role_title: "Backend Engineer")
        create(:vacancy_skill, vacancy: vacancy, skill_id: "sk-test-001",
                               skill_label: "Ruby on Rails", expected_level: 4)
        create(:skill_taxonomy, skill_id: "sk-test-001")

        authenticated_get "/api/v1/vacancies"

        expect(response).to have_http_status(:ok)
        skills = json_response_body.dig("vacancies", 0, "skills")
        expect(skills.length).to eq(1)
        expect(skills.first).to include(
          "skill_id"       => "sk-test-001",
          "skill_label"    => "Ruby on Rails",
          "expected_level" => 4
        )
        expect(skills.first["l1_anchor"]).to be_present
        expect(skills.first["l5_anchor"]).to be_present
      end
    end

    it "returns an empty skills array for a vacancy without skills" do
      with_authorized_request do
        create(:vacancy, tenant_id: tenant_id)

        authenticated_get "/api/v1/vacancies"

        expect(response).to have_http_status(:ok)
        expect(json_response_body.dig("vacancies", 0, "skills")).to eq([])
      end
    end

    it "loads taxonomy anchors for all vacancies in a single query (no N+1)" do
      with_authorized_request do
        first  = create(:vacancy, tenant_id: tenant_id)
        second = create(:vacancy, tenant_id: tenant_id)
        create(:vacancy_skill, vacancy: first,  skill_id: "sk-001", skill_label: "Ruby on Rails")
        create(:vacancy_skill, vacancy: second, skill_id: "sk-002", skill_label: "PostgreSQL")
        create(:skill_taxonomy, skill_id: "sk-001")
        create(:skill_taxonomy, skill_id: "sk-002")

        queries = []
        subscriber = ActiveSupport::Notifications.subscribe("sql.active_record") do |*, payload|
          queries << payload[:sql] unless payload[:name] == "SCHEMA"
        end
        authenticated_get "/api/v1/vacancies"
        ActiveSupport::Notifications.unsubscribe(subscriber)

        expect(response).to have_http_status(:ok)
        expect(json_response_body["vacancies"].length).to eq(2)
        taxonomy_queries = queries.select { |sql| sql.include?('FROM "skill_taxonomies"') }
        expect(taxonomy_queries.length).to eq(1)
      end
    end
  end
end
