# frozen_string_literal: true

# Live reproduction of W25, W29 and W20 on the ORIGINAL code (main b836d02).
# Synthetic data only; every database write is rolled back. Run with RAILS_ENV=test.
require 'stringio'

def header(t) = puts("\n== #{t}")

puts "revision under test: #{`git rev-parse --short HEAD`.strip} (#{Rails.root})"

header 'W25 invite link (Session#invite_url, APP_BASE_URL unset as in a default deploy)'
ENV.delete('APP_BASE_URL')
session = Session.new(invite_token: 'SYNTHETIC-TOKEN')
puts "invite_url => #{session.invite_url}"
puts 'expected: a web-app URL (port 5173 locally); /interview/:token is a React route in web/src/App.tsx'

header 'W29 candidate speech in logs (Gemini::LiveClient#log_gemini_event at info level)'
buf = StringIO.new
original = Rails.logger
Rails.logger = ActiveSupport::Logger.new(buf)
begin
  Gemini::LiveClient.allocate.send(:log_gemini_event,
                                   { 'serverContent' => { 'inputTranscription' => { 'text' => 'SYNTHETIC candidate sentence: my name is Test Person' } } })
ensure
  Rails.logger = original
end
puts "log line => #{buf.string.strip}"

header 'W20 PDF export with non-Windows-1252 AI text (Exports::PdfGenerator#call)'
ActiveRecord::Base.transaction do
  org = Organization.create!(name: 'Repro Org', scheme: "repro-#{SecureRandom.hex(3)}", identifier: "repro-#{SecureRandom.hex(3)}",
                             host: "repro-#{SecureRandom.hex(3)}.test")
  Current.tenant_id = org.id
  assessment = Assessment.create!(tenant_id: org.id, created_by: 1, name: 'Repro', time_limit_min: 30, system_prompt: 'x')
  s = Session.create!(tenant_id: org.id, assessment: assessment, status: 'ended', started_at: 5.minutes.ago,
                      ended_at: Time.current, candidate_name: 'Synthetic')
  portfolio = Portfolio.create!(session: s, generation_status: 'complete', generated_at: Time.current)
  portfolio.portfolio_skills.create!(skill_label: 'React', ai_level: 3, ai_confidence: 'high', evidence: ['quote'],
                                     competency_summary: 'Trade-offs → store; latency ≥ 200 ms ✓')
  begin
    Exports::PdfGenerator.new(portfolio: portfolio).call
    puts 'result => PDF generated (no failure)'
  rescue StandardError => e
    puts "result => #{e.class}: #{e.message.lines.first.strip[0, 160]}"
  end
  raise ActiveRecord::Rollback
end
puts "\n(all database writes rolled back)"
