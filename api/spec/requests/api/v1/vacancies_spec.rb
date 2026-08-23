# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Vacancies", type: :request do
  let(:organization) { create(:organization) }
  let(:token) do
    JsonWebToken.encode({ user_id: 1, role: "assessor", scheme: organization.scheme })
  end
  let(:headers) { { "Authorization" => "Bearer #{token}" } }

  describe "GET /api/v1/vacancies" do
    it "includes the skill labels for each vacancy" do
      vacancy = create(:vacancy, organization:)
      create(:vacancy_skill, vacancy:, skill_label: "Ruby")
      create(:vacancy_skill, vacancy:, skill_label: "SQL")

      get "/api/v1/vacancies", headers: headers

      body = JSON.parse(response.body)
      json = body["vacancies"].find { |v| v["id"] == vacancy.id }

      expect(response).to have_http_status(:ok)
      expect(json["skill_labels"]).to contain_exactly("Ruby", "SQL")
    end

    it "includes tenant-wide skill stats regardless of the current page" do
      first_vacancy = create(:vacancy, organization:)
      second_vacancy = create(:vacancy, organization:)
      create_list(:vacancy_skill, 2, vacancy: first_vacancy)
      create(:vacancy_skill, vacancy: second_vacancy)
      other_tenant_vacancy = create(:vacancy)
      create(:vacancy_skill, vacancy: other_tenant_vacancy)

      get "/api/v1/vacancies", params: { page: 2, per_page: 1 }, headers: headers

      body = JSON.parse(response.body)
      expect(body["stats"]).to eq("total_skills_tracked" => 3)
    end
  end

  describe "GET /api/v1/vacancies search" do
    it "filters by role_title, case-insensitively" do
      create(:vacancy, organization:, role_title: "Backend Engineer")
      create(:vacancy, organization:, role_title: "Data Analyst")

      get "/api/v1/vacancies", params: { q: "backend" }, headers: headers

      titles = JSON.parse(response.body)["vacancies"].map { |v| v["role_title"] }
      expect(titles).to eq(["Backend Engineer"])
    end
  end

  describe "PUT /api/v1/vacancies/:id" do
    it "removes a skill when it's sent with _destroy: true" do
      vacancy = create(:vacancy, organization:)
      keep = create(:vacancy_skill, vacancy:, skill_label: "Keep")
      drop = create(:vacancy_skill, vacancy:, skill_label: "Drop")

      put "/api/v1/vacancies/#{vacancy.id}",
          params: {
            vacancy: {
              role_title: vacancy.role_title,
              culture_dimensions: vacancy.culture_dimensions,
              competency_expectations: vacancy.competency_expectations,
              vacancy_skills_attributes: [
                { id: keep.id, skill_label: "Keep", expected_level: 3 },
                { id: drop.id, _destroy: true }
              ]
            }
          },
          headers: headers

      expect(response).to have_http_status(:ok)
      expect(vacancy.vacancy_skills.reload.pluck(:skill_label)).to eq(["Keep"])
    end
  end
end
