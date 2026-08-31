require 'rails_helper'
require 'ostruct'

RSpec.describe "Assessments API", type: :request do
  describe "POST /api/v1/assessments" do
    let(:valid_attributes) do
      {
        assessment: {
          name: "Junior Frontend Engineer",
          time_limit_min: 45,
          language: "en",
          assessment_skills_attributes: [
            {
              skill_label: "React / Frontend Development Core",
              is_custom: false,
              expected_level: 2,
              scope_include: "Component design, state management (Redux/Context), hooks, performance optimization, code splitting, testing (Jest/RTL)",
              l1_anchor: "Implements components from specs with close review. Understands JSX and basic hooks (useState, useEffect).",
              l2_anchor: "Builds routine features independently. Uses Context or Redux for shared state. Writes basic unit tests.",
              l3_anchor: "Designs and builds complex features end-to-end. Optimizes rendering (memoization, code splitting). Owns test strategy for their area.",
              l4_anchor: "Defines frontend standards for the team. Leads architecture decisions (state strategy, folder structure, build pipeline).",
              l5_anchor: "Defines frontend architecture strategy for the org. Drives cross-team adoption of patterns. Innovates on DX and performance at scale.",
              display_order: 0
            }
          ]
        }
      }
    end

    let(:invalid_attributes) do
      {
        assessment: {
          name: "",
          time_limit_min: 5
        }
      }
    end

    let(:headers) do
      {
        "Content-Type" => "application/json",
        "X-Tenant-Scheme" => "test-corp"
      }
    end

    before do
      # Set Current.organization for tenant resolution
      test_org = Organization.first
      RequestStore.store[:organization] = test_org
      Current.organization = test_org
      Current.tenant_id = test_org.id

      # Stub AuthorizeApiRequest to bypass JWT validation for tests
      test_user = OpenStruct.new(id: 1, role: "user", scheme: "test-corp")
      fake_result = { user: test_user, claims: { user_id: 1, role: "user", scheme: "test-corp" } }
      
      # Create a spy that records calls and returns our test result
      allow(AuthorizeApiRequest).to receive(:new).and_call_original
      allow_any_instance_of(AuthorizeApiRequest).to receive(:call).and_return(fake_result)
    end

    after do
      # Reset RSpec mocks
      RSpec::Mocks.space.proxy_for(ApplicationController).reset if defined?(RSpec)
      RequestStore.clear!
    end

    context "with valid attributes" do
      it "creates a new assessment" do
        expect {
          post "/api/v1/assessments", params: valid_attributes.to_json, headers: headers
        }.to change(Assessment, :count).by(1)
      end

      it "returns a successful response" do
        post "/api/v1/assessments", params: valid_attributes.to_json, headers: headers
        expect(response).to have_http_status(:created)
      end

      it "returns assessment data in response" do
        post "/api/v1/assessments", params: valid_attributes.to_json, headers: headers
        json_response = JSON.parse(response.body)
        expect(json_response["assessment"]).to be_present
        expect(json_response["assessment"]["name"]).to eq("Junior Frontend Engineer")
        expect(json_response["assessment"]["time_limit_min"]).to eq(45)
        expect(json_response["assessment"]["language"]).to eq("en")
        expect(json_response["system_prompt_generated"]).to be_truthy
      end

      it "creates associated assessment skills" do
        post "/api/v1/assessments", params: valid_attributes.to_json, headers: headers
        assessment = Assessment.last
        expect(assessment.assessment_skills.count).to eq(1)
        skill = assessment.assessment_skills.first
        expect(skill.skill_label).to eq("React / Frontend Development Core")
        expect(skill.skill_id).to eq("SK-ENG-001")
        expect(skill.is_custom).to be_falsey
        expect(skill.expected_level).to eq(2)
        expect(skill.display_order).to eq(0)
      end

      it "sets created_by to current user id" do
        post "/api/v1/assessments", params: valid_attributes.to_json, headers: headers
        assessment = Assessment.last
        expect(assessment.created_by).to eq(1)
      end
    end

    context "with invalid attributes" do
      it "does not create an assessment" do
        expect {
          post "/api/v1/assessments", params: invalid_attributes.to_json, headers: headers
        }.not_to change(Assessment, :count)
      end

      it "returns unprocessable entity response" do
        post "/api/v1/assessments", params: invalid_attributes.to_json, headers: headers
        expect(response).to have_http_status(:unprocessable_entity)
      end

      it "returns error messages" do
        post "/api/v1/assessments", params: invalid_attributes.to_json, headers: headers
        json_response = JSON.parse(response.body)
        expect(json_response["errors"]).to be_present
      end
    end

    context "without authentication" do
      before do
        # Clear user to simulate unauthenticated request
        allow(Current).to receive(:user).and_return(nil)
        # Reset the authorization stub to force authentication failure
        allow_any_instance_of(AuthorizeApiRequest).to receive(:call).and_raise(ExceptionHandler::Unauthorized, Message.unauthorized)
      end

      it "returns unauthorized response" do
        post "/api/v1/assessments", params: {}, headers: headers
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "with invalid time_limit_min" do
      let(:invalid_time_limit) do
        valid_attributes.deep_dup.tap do |attrs|
          attrs[:assessment][:time_limit_min] = 5
        end
      end

      it "returns unprocessable entity response" do
        post "/api/v1/assessments", params: invalid_time_limit.to_json, headers: headers
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end

    context "with invalid language" do
      let(:invalid_language) do
        valid_attributes.deep_dup.tap do |attrs|
          attrs[:assessment][:language] = "invalid"
        end
      end

      it "returns unprocessable entity response" do
        post "/api/v1/assessments", params: invalid_language.to_json, headers: headers
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end

    context "with multiple skills" do
      let(:multi_skills_attributes) do
        {
          assessment: {
            name: "Full Stack Developer",
            time_limit_min: 60,
            language: "en",
            assessment_skills_attributes: [
              {
                skill_label: "Node.js / Backend Development",
                is_custom: false,
                expected_level: 3,
                scope_include: "REST API design, Express/Fastify, async patterns, middleware, error handling, background jobs",
                l1_anchor: "Implements endpoints from spec with guidance. Understands request/response cycle and basic async (async/await).",
                l2_anchor: "Builds CRUD APIs independently. Handles validation, error middleware, and basic auth patterns.",
                l3_anchor: "Designs service boundaries and data flow. Implements background jobs, caching strategies, and structured logging.",
                l4_anchor: "Defines API standards across services. Leads decisions on runtime patterns, observability, and service resilience.",
                l5_anchor: "Owns backend platform strategy. Drives decisions on runtime selection, distributed system patterns, and org-wide reliability targets.",
                display_order: 0
              },
              {
                skill_label: "Database Design & SQL",
                is_custom: false,
                expected_level: 2,
                scope_include: "Schema design, normalization, indexing, query optimization, migrations, transactions, PostgreSQL/MySQL",
                l1_anchor: "Writes basic SELECT queries. Understands tables, columns, and primary keys.",
                l2_anchor: "Writes JOINs and aggregations. Designs simple schemas with foreign keys. Runs migrations safely.",
                l3_anchor: "Optimizes slow queries (EXPLAIN, indexing). Designs schemas for performance and correctness. Handles transactions and locking.",
                l4_anchor: "Defines DB standards for the team. Reviews schema changes for production impact. Leads partitioning and replication decisions.",
                l5_anchor: "Owns database strategy at org level. Evaluates DB technology choices, sets reliability and scaling targets, guides DBA practice.",
                display_order: 1
              }
            ]
          }
        }
      end

      it "creates assessment with multiple skills" do
        post "/api/v1/assessments", params: multi_skills_attributes.to_json, headers: headers
        assessment = Assessment.last
        expect(response).to have_http_status(:created)
        expect(assessment.assessment_skills.count).to eq(2)
        
        # Verify skill_ids are correctly looked up
        backend_skill = assessment.assessment_skills.find_by(skill_label: "Node.js / Backend Development")
        expect(backend_skill.skill_id).to eq("SK-ENG-002")
        
        db_skill = assessment.assessment_skills.find_by(skill_label: "Database Design & SQL")
        expect(db_skill.skill_id).to eq("SK-ENG-004")
      end
    end

    context "with missing required skill fields" do
      let(:incomplete_skill) do
        {
          assessment: {
            name: "Incomplete Skill",
            time_limit_min: 30,
            assessment_skills_attributes: [
              {
                skill_label: "Missing Anchors"
              }
            ]
          }
        }
      end

      it "returns validation error" do
        post "/api/v1/assessments", params: incomplete_skill.to_json, headers: headers
        expect(response).to have_http_status(:unprocessable_entity)
      end
    end
  end
end