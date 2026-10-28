# frozen_string_literal: true

# Builds the smallest graph the portfolio pipeline needs:
# organization -> assessment -> assessment skill -> session -> coverage map
# and transcript turns. No fixtures ship with this project, so specs create
# their own data inside the per-example transaction.
module InterviewHelpers
  Interview = Struct.new(:organization, :user, :assessment, :session, :coverage_map, keyword_init: true)

  def create_interview(skill_label: 'React / Frontend Development', state: 'covered', probe_count: 3)
    organization = Organization.create!(
      name:       'RSpec Tenant',
      scheme:     "rspec-#{SecureRandom.hex(4)}",
      identifier: "rspec-#{SecureRandom.hex(4)}",
      host:       "rspec-#{SecureRandom.hex(4)}.test"
    )

    user = User.create!(
      email:    "rspec-#{SecureRandom.hex(4)}@example.test",
      password: 'password123',
      role:     'admin'
    )

    assessment = Assessment.create!(
      tenant_id:      organization.id,
      created_by:     user.id,
      name:           'QA Engineer',
      time_limit_min: 30,
      language:       'en'
    )

    assessment.assessment_skills.create!(
      skill_id:      'sk-eng-001',
      skill_label:   skill_label,
      l1_anchor:     'L1 anchor',
      l2_anchor:     'L2 anchor',
      l3_anchor:     'L3 anchor',
      l4_anchor:     'L4 anchor',
      l5_anchor:     'L5 anchor',
      display_order: 1
    )

    session = Session.create!(
      tenant_id:      organization.id,
      assessment_id:  assessment.id,
      status:         'ended',
      ended_at:       Time.current,
      candidate_name: 'RSpec Candidate'
    )

    coverage_map = session.coverage_maps.create!(
      skill_id:      'sk-eng-001',
      skill_label:   skill_label,
      state:         state,
      probe_count:   probe_count,
      is_discovered: false
    )

    session.transcript_turns.create!(turn_number: 1, speaker: 'ai', text: 'Tell me about a project.')
    session.transcript_turns.create!(turn_number: 2, speaker: 'candidate', text: 'I built a dashboard.')

    Interview.new(
      organization: organization,
      user:         user,
      assessment:   assessment,
      session:      session,
      coverage_map: coverage_map
    )
  end
end

RSpec.configure do |config|
  config.include InterviewHelpers
end
