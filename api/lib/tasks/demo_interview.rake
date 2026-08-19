# frozen_string_literal: true
#
# Development helper only. It creates a synthetic candidate transcript and WAV
# file, then uses the normal session-ending and portfolio-generation path.
#
# Example:
# bundle exec rails "demo:seed_interview[http://localhost:5173/interview/TOKEN]" PROFILE=mid
#
require 'base64'
require 'digest'
require 'fileutils'
require 'uri'

namespace :demo do
  PROFILE_LEVELS = { 'low' => 1, 'mid' => 3, 'high' => 5 }.freeze
  TTS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions'
  TTS_SAMPLE_RATE = 24_000
  TTS_BYTES_PER_SECOND = TTS_SAMPLE_RATE * 2

  desc 'Seed synthetic candidate audio/transcript from URL; PROFILE=low|mid|high'
  task :seed_interview, [:url] => :environment do |_task, arguments|
    raise 'Synthetic seeding is development/test only' unless Rails.env.local?

    url = arguments.fetch(:url)
    profile = ENV.fetch('PROFILE', 'mid')
    level = PROFILE_LEVELS.fetch(profile) do
      raise ArgumentError, "PROFILE must be one of: #{PROFILE_LEVELS.keys.join(', ')}"
    end
    token = URI.parse(url).path[%r{/interview/([^/]+)\z}, 1]
    raise ArgumentError, 'URL must end with /interview/<invite-token>' unless token

    session = Session.find_by!(invite_token: token)
    raise 'Session must be pending' unless session.pending?
    raise 'Session already has transcript turns' if session.transcript_turns.exists?
    raise 'Session already has a portfolio' if session.portfolio.present?

    skills = session.assessment.assessment_skills.order(:display_order).to_a
    raise 'Assessment needs at least one skill' if skills.empty?

    answers = skills.map { |skill| synthetic_answer(skill.skill_label, profile) }
    pcm = synthesize(answers.join("\n\n"))
    audio_path = write_wav(session, pcm)
    seed_recording(session, audio_path, duration_ms(pcm))

    Session.transaction do
      session.update!(status: 'active', started_at: Time.current)
      seed_coverage(session, skills)
      seed_transcript(session, skills, answers, duration_ms(pcm))
    end

    Sessions::EndHandler.new(session).call(reason: 'manual_assessor')
    puts "Seeded synthetic session #{session.id} (#{profile}, target L#{level})."
    puts "Candidate WAV: #{audio_path} (also stored as the session recording)"
    puts 'Portfolio remains an unreviewed AI draft. Start Sidekiq to generate it normally.'
  rescue URI::InvalidURIError
    raise ArgumentError, 'URL must be valid'
  end

  def synthetic_answer(skill_label, profile)
    case profile
    when 'low'
      "For #{skill_label}, I understand the basic terms and can follow an existing example. I need a senior engineer to split work into steps and review my changes. When an unfamiliar issue occurs, I ask for help before deciding what to try."
    when 'mid'
      "For #{skill_label}, I owned a production change with ambiguous requirements. I compared options, chose the simplest rollback path, added tests around the risky boundary, and checked logs and metrics after release. When the first approach increased latency, I traced the bottleneck, changed the data flow, and documented the trade-off for the team."
    when 'high'
      "For #{skill_label}, I set an engineering standard across several teams rather than solving one ticket. I introduced a reusable decision framework, defined reliability measures, and coached leads to apply it. When adoption exposed a systemic bottleneck, I changed the platform contract, measured the organisation-wide outcome, and kept a decision record so teams could evolve the approach safely."
    end
  end

  def synthesize(text)
    api_key = ENV.fetch('GEMINI_API_KEY')
    model = ENV.fetch('GEMINI_TTS_MODEL', 'gemini-3.1-flash-tts-preview')
    response = Faraday.post(
      TTS_URL,
      {
        model: model,
        input: "Synthesize this synthetic candidate interview answer naturally. Do not add words.\n\n#{text}",
        response_format: { type: 'audio' },
        generation_config: { speech_config: [{ voice: 'Kore' }] }
      }.to_json,
      { 'Content-Type' => 'application/json', 'x-goog-api-key' => api_key, 'Api-Revision' => '2026-05-20' }
    )
    raise "Gemini TTS failed with #{response.status}" unless response.success?

    encoded = JSON.parse(response.body).dig('output_audio', 'data')
    raise 'Gemini TTS response did not include audio' unless encoded.is_a?(String)

    Base64.strict_decode64(encoded)
  rescue Faraday::Error => error
    raise "Gemini TTS request failed: #{error.message}"
  end

  def seed_coverage(session, skills)
    skills.each do |skill|
      session.coverage_maps.create!(
        skill_id: skill.skill_id,
        skill_label: skill.skill_label,
        is_discovered: false,
        state: 'covered',
        probe_count: 3,
        last_signal: 'Synthetic demo fixture'
      )
    end
  end

  def seed_transcript(session, skills, answers, total_duration_ms)
    total_characters = answers.sum(&:length)
    current_ms = 0
    skills.zip(answers).each_with_index do |(skill, answer), index|
      turn_number = (index * 2) + 1
      duration = [(total_duration_ms.to_f * answer.length / total_characters).round, 1].max
      session.transcript_turns.create!(turn_number: turn_number, speaker: 'ai', text: "Please describe your experience with #{skill.skill_label}.")
      session.transcript_turns.create!(turn_number: turn_number + 1, speaker: 'candidate', text: answer, audio_start_ms: current_ms, audio_end_ms: current_ms + duration)
      current_ms += duration
    end
  end

  def duration_ms(pcm)
    ((pcm.bytesize.to_f / TTS_BYTES_PER_SECOND) * 1_000).round
  end

  def write_wav(session, pcm)
    directory = Rails.root.join('tmp', 'synthetic_interviews')
    FileUtils.mkdir_p(directory)
    path = directory.join("session-#{session.id}-candidate.wav")
    header = ['RIFF', 36 + pcm.bytesize, 'WAVE', 'fmt ', 16, 1, 1, TTS_SAMPLE_RATE, TTS_BYTES_PER_SECOND, 2, 16, 'data', pcm.bytesize].pack('A4VA4A4VvvVVvvA4V')
    File.binwrite(path, header + pcm)
    path
  end

  def seed_recording(session, audio_path, recording_duration_ms)
    audio = File.binread(audio_path)
    key = "recordings/#{session.tenant_id}/#{session.id}/synthetic-#{SecureRandom.uuid}"
    InterviewRecordings::Storage.new.upload(key: key, body: audio, content_type: 'audio/wav')
    session.create_interview_recording!(
      object_key: key,
      content_type: 'audio/wav',
      byte_size: audio.bytesize,
      duration_ms: recording_duration_ms,
      checksum: Digest::SHA256.hexdigest(audio),
      captured_at: Time.current,
      expires_at: InterviewRecording::RETENTION_DAYS.days.from_now
    )
  end
end
