# frozen_string_literal: true

module RequestHelpers
  def stub_assessor_auth!(tenant_id: 9_100)
    organization = OpenStruct.new(id: tenant_id, scheme: 'test-org')
    Current.organization = organization
    Current.tenant_id = tenant_id
    Current.user = OpenStruct.new(id: 1, role: 'assessor')

    allow_any_instance_of(ApplicationController).to receive(:authenticate_with_roles!).and_return(true)
    allow_any_instance_of(ApplicationController).to receive(:require_tenant!).and_return(true)
    allow_any_instance_of(ApplicationController).to receive(:current_tenant_id).and_return(tenant_id)
  end

  def stub_tenant_only!(tenant_id: 9_100)
    allow_any_instance_of(ApplicationController).to receive(:require_tenant!).and_return(true)
    allow_any_instance_of(ApplicationController).to receive(:current_tenant_id).and_return(tenant_id)
  end

  def create_assessment!(tenant_id: Current.tenant_id || 9_100)
    Assessment.create!(
      tenant_id: tenant_id,
      created_by: 1,
      name: 'Harness assessment',
      time_limit_min: 30
    )
  end

  def create_ended_session!(assessment: nil, tenant_id: Current.tenant_id || 9_100)
    assessment ||= create_assessment!(tenant_id: tenant_id)
    assessment.sessions.create!(
      tenant_id: tenant_id,
      status: 'ended',
      end_reason: 'all_covered',
      ended_at: Time.current,
      candidate_name: 'Ada Lovelace'
    )
  end

  def create_portfolio!(session:, status: 'complete', error: nil)
    session.create_portfolio!(
      generation_status: status,
      generation_error: error,
      generated_at: status == 'complete' ? Time.current : nil
    )
  end

  def create_portfolio_skill!(portfolio, skill_label: 'React', ai_level: 3)
    portfolio.portfolio_skills.create!(
      skill_id: 'react',
      skill_label: skill_label,
      ai_level: ai_level,
      ai_confidence: 'medium',
      competency_summary: "#{skill_label} competency summary",
      evidence: ['Showed a component tree']
    )
  end

  def create_vacancy!(tenant_id: Current.tenant_id || 9_100)
    Vacancy.create!(
      tenant_id: tenant_id,
      created_by: 1,
      role_title: 'Frontend Engineer'
    )
  end

  def json_body
    JSON.parse(response.body)
  end
end
