# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'Api::V1::Portfolios Export API', type: :request do
  let(:org_1) do
    Organization.find_or_create_by!(scheme: 'tenant-one') do |o|
      o.name = 'Tenant One Corp'
      o.identifier = 'tenant-one'
      o.host = 'tenant-one.local'
    end
  end

  let(:org_2) do
    Organization.find_or_create_by!(scheme: 'tenant-two') do |o|
      o.name = 'Tenant Two Corp'
      o.identifier = 'tenant-two'
      o.host = 'tenant-two.local'
    end
  end

  let(:token_org_1) do
    JsonWebToken.encode({ user_id: 1, role: 'admin', scheme: org_1.scheme })
  end

  let(:token_org_2) do
    JsonWebToken.encode({ user_id: 2, role: 'admin', scheme: org_2.scheme })
  end

  let(:headers_org_1) do
    {
      'Authorization' => "Bearer #{token_org_1}",
      'Content-Type' => 'application/json'
    }
  end

  let(:headers_org_2) do
    {
      'Authorization' => "Bearer #{token_org_2}",
      'Content-Type' => 'application/json'
    }
  end

  let(:assessment_1) do
    Assessment.create!(
      tenant_id: org_1.id,
      created_by: 1,
      name: 'Fullstack Engineer Assessment',
      time_limit_min: 45
    )
  end

  let(:session_1) do
    Session.create!(
      tenant_id: org_1.id,
      assessment_id: assessment_1.id,
      candidate_name: 'Dewi Lestari',
      status: 'ended',
      duration_seconds: 1200
    )
  end

  let(:portfolio_1) do
    Portfolio.create!(
      session_id: session_1.id,
      generation_status: 'complete',
      generated_at: Time.current
    )
  end

  let!(:skill_1) do
    portfolio_1.portfolio_skills.create!(
      skill_id: 'SK-ENG-001',
      skill_label: 'React / Frontend Development Core',
      is_discovered: false,
      ai_level: 4,
      ai_confidence: 'high',
      evidence: ['“Architected modular state using Jotai and custom hooks.”'],
      competency_summary: 'Advanced capabilities in modern React architecture.'
    )
  end

  let(:vacancy_1) do
    Vacancy.create!(
      tenant_id: org_1.id,
      created_by: 1,
      role_title: 'Senior Frontend Specialist',
      culture_dimensions: 'Proactive and communicative.'
    )
  end

  let!(:fit_gap_1) do
    FitGapReport.create!(
      portfolio_id: portfolio_1.id,
      vacancy_id: vacancy_1.id,
      skill_comparisons: [
        {
          'skill_label' => 'React / Frontend Development Core',
          'expected_level' => 4,
          'candidate_level' => 4,
          'result' => 'match',
          'delta' => 0
        }
      ],
      culture_narrative: 'High culture synergy.',
      overall_narrative: 'Recommended for hiring.'
    )
  end

  describe 'GET /api/v1/portfolios/:id/export' do
    context 'when exporting as PDF' do
      it 'returns 200 OK with binary application/pdf' do
        get "/api/v1/portfolios/#{portfolio_1.id}/export?format=pdf&vacancy_id=#{vacancy_1.id}", headers: headers_org_1

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to eq('application/pdf')
        expect(response.headers['Content-Disposition']).to include("filename=\"portfolio-#{portfolio_1.id}.pdf\"")
        expect(response.body.start_with?('%PDF-')).to be true
      end
    end

    context 'when exporting as JSON' do
      it 'returns 200 OK with formatted JSON payload including portfolio and fit gap report' do
        get "/api/v1/portfolios/#{portfolio_1.id}/export?format=json&vacancy_id=#{vacancy_1.id}", headers: headers_org_1

        expect(response).to have_http_status(:ok)
        expect(response.content_type).to include('application/json')
        body = JSON.parse(response.body)
        expect(body).to have_key('portfolio')
        expect(body).to have_key('fit_gap_report')
        expect(body['portfolio']['id']).to eq(portfolio_1.id)
        expect(body['fit_gap_report']['vacancy_id']).to eq(vacancy_1.id)
      end
    end

    context 'when format is invalid' do
      it 'returns 422 Unprocessable Entity' do
        get "/api/v1/portfolios/#{portfolio_1.id}/export?format=docx", headers: headers_org_1

        expect(response).to have_http_status(:unprocessable_entity)
        body = JSON.parse(response.body)
        expect(body['errors'][0]['message']).to eq("Format must be 'pdf' or 'json'")
      end
    end

    context 'when portfolio generation is not complete' do
      let(:pending_portfolio) do
        s = Session.create!(
          tenant_id: org_1.id,
          assessment_id: assessment_1.id,
          status: 'active'
        )
        Portfolio.create!(session_id: s.id, generation_status: 'generating')
      end

      it 'returns 422 Unprocessable Entity with descriptive message' do
        get "/api/v1/portfolios/#{pending_portfolio.id}/export?format=pdf", headers: headers_org_1

        expect(response).to have_http_status(:unprocessable_entity)
        body = JSON.parse(response.body)
        expect(body['errors'][0]['message']).to include('Portfolio is not ready for export')
      end
    end

    context 'when requested vacancy does not exist' do
      it 'returns 404 Not Found' do
        get "/api/v1/portfolios/#{portfolio_1.id}/export?format=pdf&vacancy_id=999999", headers: headers_org_1

        expect(response).to have_http_status(:not_found)
        body = JSON.parse(response.body)
        expect(body['errors'][0]['message']).to eq('Vacancy not found')
      end
    end

    context 'when accessed by another tenant (tenant boundary isolation)' do
      it 'rejects cross-tenant access with 404 Not Found' do
        get "/api/v1/portfolios/#{portfolio_1.id}/export?format=pdf", headers: headers_org_2

        expect(response).to have_http_status(:not_found)
        body = JSON.parse(response.body)
        expect(body['errors'][0]['message']).to eq('Portfolio not found')
      end
    end
  end
end
