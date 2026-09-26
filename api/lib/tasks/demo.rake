# frozen_string_literal: true

# A realistic demo day for the assessor home, with fictional people only.
#   bin/rails demo:seed                      # the only organization, if there is one
#   DEMO_TENANT="test-corp" bin/rails demo:seed  # by name, scheme or identifier
# It REPLACES the tenant's assessments and interviews. It never runs in production.
namespace :demo do
  desc "Replace this tenant's interview data with a realistic demo day (local only)"
  task seed: :environment do
    abort 'demo:seed never runs in production.' if Rails.env.production?

    DemoDay.new(DemoDay.organization(ENV['DEMO_TENANT'].presence)).call
  end
end

class DemoDay
  SKILLS = {
    'Management Trainee 2026 · Batch 2' => ['Communication', 'Problem Solving', 'Collaboration', 'Adaptability', 'Leadership & Ownership'],
    'Senior Frontend Engineer' => ['React / Frontend Development', 'System Design', 'Testing'],
    'Customer Service Officer' => ['Communication', 'Empathy', 'Problem Solving']
  }.freeze

  # By name, scheme or identifier; without one, the only organization there is.
  # (The web app's tenant label comes from VITE_DEV_TENANT_NAME, not the database.)
  def self.organization(wanted)
    found = wanted ? Organization.where('? IN (name, scheme, identifier)', wanted).to_a : Organization.all.to_a
    return found.first if found.size == 1

    known = Organization.pluck(:name, :scheme).map { |name, scheme| "#{name} (#{scheme})" }.join(', ')
    abort('No organization yet. Run bundle exec rails db:seed first.') if known.empty?
    abort(wanted ? "No organization matches #{wanted.inspect}. Known: #{known}." : "Several organizations exist: #{known}. Set DEMO_TENANT to one of them.")
  end

  def initialize(org)
    @org = org
    @owner = (User.first&.id || 1)
    @now = Time.current
  end

  def call
    ActiveRecord::Base.transaction do
      reset
      mt, fe, cs = SKILLS.keys.map { |name| assessment(name) }

      # Failed on our side: they need a re-invite (one already has one).
      failed(mt, 'Sekar Arum Paramitha', 2.hours.ago)
      failed(mt, 'Rara Wibisono', 1.day.ago + 40.minutes)
      failed(cs, 'Anindya Kusumawardhani Prameswari Wijayakusuma Setyaningrum Hadiningrat', 26.hours.ago)
      failed(fe, 'Budi Hartono', 3.days.ago)
      invite(fe, 'Budi Hartono', 1.day.ago) # re-invited: leaves "Needs you"

      # Reports that are stuck, and can be tried again.
      report(mt, 'Rizky Ramadhan', 40.minutes.ago, %w[assessed assessed assessed thin_evidence assessed], generation: 'generating', changed: 12.minutes.ago)
      report(fe, 'Nadia Putri', 5.hours.ago, %w[assessed assessed assessed], generation: 'failed', kind: 'model_unavailable')

      # Fresh results, with the honest mix of evidence.
      report(mt, 'Ayu Lestari', 50.minutes.ago, %w[assessed assessed thin_evidence assessed not_assessed])
      report(fe, 'Kevin Pratama', 3.hours.ago, %w[assessed assessed assessed])
      report(cs, 'Maria Simanjuntak', 20.hours.ago, %w[assessed assessed unavailable])
      report(fe, 'Made Wirawan', 2.days.ago, %w[assessed thin_evidence assessed])
      report(mt, 'Siti Rahmawati', 3.days.ago, %w[assessed assessed assessed assessed not_assessed])
      report(cs, 'Andi Saputra', 5.days.ago, %w[assessed assessed assessed])

      # Interviewing now, and one session stuck as live.
      live(mt, 'Dimas Prakoso', 12.minutes.ago)
      live(cs, 'Putri Maharani', 31.minutes.ago)
      live(fe, 'Kevin Halim', 2.hours.ago + -10.minutes)

      # Invites nobody has opened yet (some going cold).
      ['Fajar Nugroho', 'Dewi Kartika', 'Yohanes Situmorang'].each { |n| invite(mt, n, 5.days.ago) }
      invite(cs, 'Lina Wijaya', 4.hours.ago)
    end
    puts "Demo day ready for #{@org.name}: #{Session.unscoped.where(tenant_id: @org.id).count} sessions."
  end

  private

  def reset
    sessions = Session.unscoped.where(tenant_id: @org.id)
    FitGapReport.where(portfolio_id: Portfolio.where(session_id: sessions.select(:id))).delete_all
    sessions.find_each(&:destroy!)
    Assessment.unscoped.where(tenant_id: @org.id).find_each(&:destroy!)
  end

  def assessment(name)
    a = Assessment.unscoped.create!(tenant_id: @org.id, created_by: @owner, name: name,
                                    time_limit_min: name.start_with?('Management') ? 45 : 30,
                                    language: name.start_with?('Senior') ? 'en' : 'id')
    SKILLS[name].each_with_index do |label, i|
      a.assessment_skills.create!(skill_label: label, display_order: i, expected_level: 3,
                                  l1_anchor: 'Needs close guidance.', l2_anchor: 'Handles routine work alone.',
                                  l3_anchor: 'Handles complex work and explains trade-offs.',
                                  l4_anchor: 'Sets standards that others follow.', l5_anchor: 'Shapes how the whole organisation works.')
    end
    a
  end

  def session(assessment, name, **attrs)
    Session.unscoped.create!(tenant_id: @org.id, assessment: assessment, candidate_name: name, **attrs)
  end

  def invite(assessment, name, at)
    session(assessment, name, status: 'pending', created_at: at)
  end

  def failed(assessment, name, at)
    s = session(assessment, name, status: 'ended', end_reason: 'error', created_at: at - 1.day,
                                  started_at: at - 8.seconds, ended_at: at, duration_seconds: 8)
    s.create_portfolio!(generation_status: 'failed', failure_kind: 'no_interview_data',
                        generation_error: 'The interview has no transcript turns')
  end

  def live(assessment, name, started)
    s = session(assessment, name, status: 'active', created_at: started - 1.day, started_at: started)
    SKILLS[assessment.name].each { |label| s.coverage_maps.create!(skill_label: label, state: 'initiated', probe_count: 1) }
  end

  QUOTES = ['I start by asking what the customer actually needs, then I agree on one next step.',
            'When the plan changed, I split the work so the team could still ship on Friday.',
            'I measured it first, then fixed the slowest part and checked it again.'].freeze

  def report(assessment, name, ended, statuses, generation: 'complete', kind: nil, changed: nil)
    minutes = assessment.time_limit_min - 4
    s = session(assessment, name, status: 'ended', end_reason: 'all_covered', created_at: ended - 2.days,
                                  started_at: ended - minutes.minutes, ended_at: ended, duration_seconds: minutes * 60)
    6.times do |i|
      s.transcript_turns.create!(turn_number: i + 1, speaker: i.even? ? 'ai' : 'candidate',
                                 text: i.even? ? 'Tell me about a time you had to decide quickly.' : QUOTES[i % 3])
    end
    labels = SKILLS[assessment.name]
    labels.zip(statuses).each do |label, status|
      state, probes = { 'not_assessed' => ['not_yet', 0], 'thin_evidence' => ['partial', 1] }.fetch(status, ['covered', 3])
      s.coverage_maps.create!(skill_label: label, state: state, probe_count: probes)
    end

    p = s.create_portfolio!(generation_status: generation, failure_kind: kind,
                            generated_at: (ended + 2.minutes if generation == 'complete'))
    p.update_column(:status_changed_at, changed || ended + 2.minutes)
    return unless generation == 'complete'

    labels.zip(statuses).each_with_index do |(label, status), i|
      rated = %w[assessed thin_evidence].include?(status)
      p.portfolio_skills.create!(
        skill_label: label, status: status, coverage_state: rated ? (status == 'thin_evidence' ? 'partial' : 'covered') : 'not_yet',
        probe_count: status == 'thin_evidence' ? 1 : (rated ? 3 : 0), caveat: ('low_probe_count' if status == 'thin_evidence'),
        ai_level: (rated ? [2, 3, 3, 4][i % 4] : nil), ai_confidence: (rated ? (status == 'assessed' ? 'high' : 'low') : nil),
        evidence: rated ? [QUOTES[i % 3]] : [], competency_summary: (rated ? 'Explains a clear approach and checks the result.' : nil),
        raw_level: (status == 'unavailable' ? '"strong"' : nil)
      )
    end
  end
end
