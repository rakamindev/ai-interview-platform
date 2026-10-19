# frozen_string_literal: true

module TenantAuthHelpers
  ANCHORS = {
    l1_anchor: 'Level 1 anchor text',
    l2_anchor: 'Level 2 anchor text',
    l3_anchor: 'Level 3 anchor text',
    l4_anchor: 'Level 4 anchor text',
    l5_anchor: 'Level 5 anchor text'
  }.freeze

  def ensure_organization(attrs)
    Organization.find_or_create_by!(scheme: attrs[:scheme]) do |org|
      org.name       = attrs[:name]
      org.identifier = attrs[:identifier]
      org.host       = attrs[:host]
    end
  end

  def ensure_admin_user(email: 'admin@test.com')
    User.find_or_create_by!(email: email) do |u|
      u.password = 'password'
      u.role     = 'admin'
    end
  end

  def auth_headers(organization, user: ensure_admin_user)
    token = JsonWebToken.encode(
      user_id: user.id,
      role:    user.role,
      scheme:  organization.scheme
    )
    { 'Authorization' => "Bearer #{token}" }
  end

  def create_assessment_for(tenant_id, name: 'Demo Assessment', user_id: 1)
    assessment = Assessment.unscoped.create!(
      tenant_id:      tenant_id,
      created_by:     user_id,
      name:           name,
      time_limit_min: 30
    )
    assessment.assessment_skills.create!(
      { skill_label: 'Communication', display_order: 0 }.merge(ANCHORS)
    )
    assessment
  end

  def create_session_for(assessment, tenant_id, candidate_name: 'Kandidat Demo', status: 'ended')
    attrs = {
      tenant_id:      tenant_id,
      assessment_id:  assessment.id,
      invite_token:   SecureRandom.hex(32),
      candidate_name: candidate_name,
      status:         status
    }
    attrs[:started_at] = Time.current if status == 'active'
    Session.unscoped.create!(attrs)
  end

  def create_coverage_map(session, skill_label: 'Communication', state: 'not_yet', discovered: false)
    session.coverage_maps.create!(
      skill_label:   skill_label,
      is_discovered: discovered,
      state:         state,
      probe_count:   state == 'covered' ? 3 : 0
    )
  end

  def create_complete_portfolio_for(session, candidate_id: nil)
    session.create_portfolio!(
      candidate_id:      candidate_id,
      generation_status: 'complete',
      generated_at:      Time.current
    )
  end

  def create_vacancy_for(tenant_id, user_id: 1, title: 'Engineer')
    vacancy = Vacancy.unscoped.create!(
      tenant_id:   tenant_id,
      created_by:  user_id,
      role_title:  title
    )
    vacancy.vacancy_skills.create!(
      skill_label:    'Communication',
      expected_level: 3
    )
    vacancy
  end
end

RSpec.configure do |config|
  config.include TenantAuthHelpers, type: :request
  config.include TenantAuthHelpers, type: :model
end
