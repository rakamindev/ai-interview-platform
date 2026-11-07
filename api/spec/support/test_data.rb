# frozen_string_literal: true

# Small builders for synthetic test data. No real candidate data is used anywhere in the suite.
module TestData
  def create_org(scheme: 'acme', id: nil)
    Organization.create!(
      id: id, name: scheme.capitalize, scheme: scheme, identifier: scheme, host: "#{scheme}.test"
    )
  end

  def create_assessment(org:, skills: [{ skill_id: nil, skill_label: 'React / Frontend Development Core' }])
    assessment = Assessment.create!(
      tenant_id: org.id, created_by: 1, name: 'Senior Frontend Engineer',
      time_limit_min: 30, system_prompt: 'test prompt'
    )
    skills.each_with_index do |s, i|
      assessment.assessment_skills.create!(
        skill_id: s[:skill_id], skill_label: s[:skill_label], display_order: i,
        l1_anchor: 'L1 anchor', l2_anchor: 'L2 anchor', l3_anchor: 'L3 anchor',
        l4_anchor: 'L4 anchor', l5_anchor: 'L5 anchor'
      )
    end
    assessment
  end

  # A session with a short synthetic transcript and coverage map (active by default, so EndHandler can end it).
  def create_interviewed_session(org:, assessment:)
    session = Session.create!(
      tenant_id: org.id, assessment: assessment, status: 'active',
      started_at: 10.minutes.ago, candidate_name: 'Test Candidate'
    )
    [
      ['ai', 'Tell me about state management in React.'],
      ['candidate', 'For a live feed, context gets painful fast because every update re-renders every consumer.'],
      ['ai', 'How did you fix that?'],
      ['candidate', 'I moved the feed into a store so components subscribe to just the slice they need.']
    ].each_with_index do |(speaker, text), i|
      session.transcript_turns.create!(turn_number: i + 1, speaker: speaker, text: text)
    end
    assessment.assessment_skills.each do |s|
      session.coverage_maps.create!(skill_id: s.skill_id, skill_label: s.skill_label, state: 'covered', probe_count: 3)
    end
    session
  end

  # A model response in the shape the N10 prompt asks for.
  def model_output(level:, quote:, label: 'React / Frontend Development Core', skill_id: nil)
    {
      'configured_skills' => [
        { 'skill_id' => skill_id, 'skill_label' => label, 'level' => level,
          'confidence' => 'high', 'evidence' => [quote], 'competency_summary' => "Summary for L#{level}" }
      ],
      'discovered_skills' => []
    }
  end

  # A stand-in for Gemini::HttpClient that returns queued responses (or raises queued errors) in order.
  class FakeGemini
    def initialize(*responses)
      @responses = responses
    end

    def generate_content(*)
      next_response = @responses.shift
      raise next_response if next_response.is_a?(Exception)

      next_response
    end
  end

  def stub_gemini(*responses)
    fake = FakeGemini.new(*responses)
    allow(Gemini::HttpClient).to receive(:new).and_return(fake)
    fake
  end
end

# Helpers for driving Sidekiq jobs by hand, so job order is controlled by the test, not by timing.
module JobControl
  def last_enqueued_args(worker)
    worker.jobs.last.fetch('args')
  end

  def run_job(worker, args)
    worker.new.perform(*args)
  end

  def auth_headers(org, user_id: 1)
    { 'Authorization' => "Bearer #{JsonWebToken.encode({ user_id: user_id, role: 'admin', scheme: org.scheme })}" }
  end
end
