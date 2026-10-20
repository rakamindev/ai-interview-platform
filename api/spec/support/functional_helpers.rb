# frozen_string_literal: true

# Helpers for spec/functional: drive the API the way the web app does, over HTTP,
# with background jobs run explicitly so each step of a journey is visible.
module FunctionalHelpers
  JSON_HEADERS = { 'Content-Type' => 'application/json' }.freeze

  # Signs in through the real login endpoint and returns headers for later calls.
  def sign_in_as(user, organization)
    post '/api/v1/auth/login',
         params:  { email: user.email, password: user.password }.to_json,
         headers: JSON_HEADERS.merge('X-Tenant-Scheme' => organization.scheme)
    expect(response).to have_http_status(:ok), "login failed: #{response.body}"

    JSON_HEADERS.merge('Authorization' => "Bearer #{response.parsed_body['token']}")
  end

  def json
    response.parsed_body
  end

  # Runs every job of a worker class that the previous steps enqueued.
  def run_jobs(worker_class)
    count = worker_class.jobs.size
    worker_class.drain
    count
  end

  # The audio WebSocket starts the session, records turns and updates coverage.
  # That layer needs a live model (constraint C1), so a journey stands in for it
  # by doing exactly what it persists.
  def simulate_interview(session, turns:, coverage:)
    Sessions::StartHandler.new(session).call

    turns.each_with_index do |(speaker, text), i|
      session.transcript_turns.create!(turn_number: i + 1, speaker:, text:)
    end

    coverage.each do |label, (state, probe_count)|
      session.coverage_maps.find_by!(skill_label: label).update!(state:, probe_count:)
    end
  end
end

RSpec.configure do |config|
  config.include FunctionalHelpers, type: :request
end
