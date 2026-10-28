# frozen_string_literal: true

# Dev-only scenario seed for exploring the Portfolio -> Override -> Fit/Gap flow
# without running a live interview (no microphone, no real Gemini calls).
#
# Usage (from api/):
#   bundle exec rails runner db/seeds/dev_scenarios.rb
#
# Idempotent: removes previously seeded "Contoh" data, then recreates it.
# Every person, transcript and quote below is obviously fake dummy data.
#
# Portfolios and fit/gap reports are produced by the real Portfolios::Generator
# and FitGap::Engine with fake Gemini clients, so the stored values show what
# the current code does with each kind of model output.

abort('dev_scenarios.rb is for local development only') unless Rails.env.development?

module DevScenarios
  PREFIX      = 'Contoh'
  ASSESSOR_ID = 1

  LONG_LABEL    = ('Observability, Incident Response & Reliability Engineering ' \
                   'untuk sistem terdistribusi multi-region dengan SLO ketat ' * 3)[0, 200]
  LONG_EVIDENCE = 'Kandidat Contoh F: kutipan sangat panjang tentang penanganan insiden fiktif. ' * 16
  LONG_SUMMARY  = 'Ringkasan kompetensi yang sangat panjang untuk menguji layout. ' * 25

  VACANCY_SKILLS = [
    ['Ruby on Rails', 3],
    ['SQL & Data Modeling', 3],
    ['API Design', 3],
    ['System Design', 4],
    ['Komunikasi Teknis', 2]
  ].freeze

  NARRATIVE = {
    'culture_narrative' => 'Contoh narasi budaya dari fake Gemini client.',
    'overall_narrative' => 'Contoh narasi keseluruhan dari fake Gemini client.'
  }.freeze

  # Stands in for Gemini::HttpClient: returns a canned response or raises.
  class FakeGeminiClient
    def initialize(response = nil, error: nil)
      @response = response
      @error    = error
    end

    def generate_content(_prompt, temperature: nil)
      raise @error if @error

      @response
    end
  end

  module_function

  def run
    org_a = Organization.find_by(scheme: 'test-corp') ||
            abort('Organization test-corp not found. Run `rails db:seed` first.')
    org_b = find_or_create_org_b

    reset!
    results = []
    Current.using(tenant_id: org_a.id) { results.concat(seed_tenant_a) }
    Current.using(tenant_id: org_b.id) { results.concat(seed_tenant_b) }
    print_summary(results)
    print_pending_invite
  end

  def find_or_create_org_b
    Organization.find_or_create_by!(scheme: 'contoh-b') do |org|
      org.name       = 'Contoh Org B'
      org.identifier = 'contoh-b'
      org.host       = 'contoh-b.invalid'
    end
  end

  def reset!
    sessions  = Session.unscoped.where('candidate_name LIKE ?', "Kandidat #{PREFIX}%")
    vacancies = Vacancy.unscoped.where('role_title LIKE ?', "#{PREFIX} %")
    portfolio_ids = Portfolio.where(session_id: sessions.select(:id)).select(:id)

    FitGapReport.where(portfolio_id: portfolio_ids).delete_all
    FitGapReport.where(vacancy_id: vacancies.select(:id)).delete_all
    sessions.find_each(&:destroy!)
    vacancies.find_each(&:destroy!)
    Assessment.unscoped.where('name LIKE ?', "#{PREFIX} %").find_each(&:destroy!)
  end

  # ---------------------------------------------------------------------------
  # Tenant A scenarios
  # ---------------------------------------------------------------------------

  def seed_tenant_a
    assessment   = create_assessment("#{PREFIX} Assessment Backend", VACANCY_SKILLS.map(&:first))
    vacancy      = create_vacancy("#{PREFIX} Backend Engineer", VACANCY_SKILLS)
    long_vacancy = create_vacancy("#{PREFIX} SRE Engineer (teks panjang)", [[LONG_LABEL, 3], ['Ruby on Rails', 3]])
    empty_vacancy = create_vacancy("#{PREFIX} Vacancy tanpa skill", [])

    normal = scenario(assessment, vacancy, 'A', 'normal: semua skill dinilai', normal_response('A'))
    @pending_invite = pending_invite(assessment)
    [
      normal,
      scenario(assessment, vacancy, 'B', 'skill vacancy tidak dibahas', not_covered_response,
               coverage: { 'System Design' => ['not_yet', 0], 'Komunikasi Teknis' => ['initiated', 1] },
               narrative_error: Gemini::HttpClient::TimeoutError.new('fake timeout')),
      scenario(assessment, vacancy, 'C', 'level AI kosong/invalid', invalid_level_response),
      scenario(assessment, vacancy, 'D', 'confidence rendah', low_confidence_response,
               coverage: VACANCY_SKILLS.to_h { |label, _| [label, ['partial', 1]] }),
      override_scenario(assessment, vacancy),
      scenario(assessment, long_vacancy, 'F', 'teks sangat panjang', long_text_response,
               narrative: { 'culture_narrative' => LONG_SUMMARY, 'overall_narrative' => LONG_SUMMARY }),
      failed_scenario(assessment, 'H', 'JSON Gemini rusak (generation_error)', broken_json_response),
      failed_scenario(assessment, 'I', 'confidence di luar enum (diabaikan, dihitung dari coverage)',
                      partial_write_response),
      scenario(assessment, vacancy, 'J', 'portfolio lama (legacy)', normal_response('J')) do |portfolio|
        portfolio.update_columns(ratings_validated: false)
      end,
      outdated_scenario(assessment, vacancy),
      empty_portfolio_scenario(assessment, vacancy),
      normal.merge(code: 'M', label: 'vacancy tanpa skill', vacancy: empty_vacancy, report: nil),
      normal.merge(code: 'N', label: 'narasi belum diminta', vacancy: long_vacancy, report: nil)
    ]
  end

  # A rating changes after the narrative was written, so the narrative is outdated.
  def outdated_scenario(assessment, vacancy)
    result = scenario(assessment, vacancy, 'K', 'narasi outdated', normal_response('K'))
    add_override(result[:portfolio], 'API Design', 2, 'Contoh catatan: diturunkan setelah narasi ditulis.')
    result
  end

  # A complete portfolio in which no skill was rated at all.
  def empty_portfolio_scenario(assessment, vacancy)
    session = create_session(assessment, 'L')
    portfolio = Portfolio.create!(session: session, generation_status: 'complete', generated_at: Time.current,
                                  ratings_validated: true)
    { code: 'L', label: 'portfolio tanpa skill', assessment: assessment, session: session,
      portfolio: portfolio, vacancy: vacancy, report: nil }
  end

  # A candidate who has not started yet, for the invite list and the candidate
  # pages (landing and hardware check). Removed by reset! like the others.
  def pending_invite(assessment)
    Session.create!(assessment: assessment, status: 'pending', candidate_name: "Kandidat #{PREFIX} Undangan")
  end

  def seed_tenant_b
    assessment = create_assessment("#{PREFIX} Assessment Org B", VACANCY_SKILLS.map(&:first))
    vacancy    = create_vacancy("#{PREFIX} Backend Engineer Org B", VACANCY_SKILLS)

    [scenario(assessment, vacancy, 'G', 'milik Org B (uji lintas tenant)', normal_response('G'))]
  end

  def scenario(assessment, vacancy, code, label, response, narrative: NARRATIVE, narrative_error: nil, coverage: {})
    session   = create_session(assessment, code)
    add_coverage(session, response, coverage)
    portfolio = Portfolios::Generator.new(session: session, gemini_client: FakeGeminiClient.new(response)).call
    yield portfolio if block_given?

    narrative_client = FakeGeminiClient.new(narrative, error: narrative_error)
    report = FitGap::Engine.new(portfolio: portfolio, vacancy: vacancy, gemini_client: narrative_client).call

    { code: code, label: label, assessment: assessment, session: session,
      portfolio: portfolio.reload, vacancy: vacancy, report: report }
  end

  # Overrides go through the same service as the API (with the required note
  # and a history event) before the fit/gap report is built, so the report
  # reflects them. One raises a level, one lowers it, and one AI level is
  # confirmed, so the screens and the PDF show all three review markers.
  def override_scenario(assessment, vacancy)
    scenario(assessment, vacancy, 'E', 'override dan konfirmasi asesor', normal_response('E')) do |portfolio|
      add_override(portfolio, 'SQL & Data Modeling', 3, 'Contoh catatan: bukti tambahan dari studi kasus tertulis.')
      add_override(portfolio, 'Komunikasi Teknis', 1, 'Contoh catatan: diturunkan setelah diskusi panel.')
      add_confirm(portfolio, 'Ruby on Rails', 'Contoh catatan: bukti cukup dari jawaban kandidat.')
    end
  end

  def failed_scenario(assessment, code, label, response)
    session = create_session(assessment, code)
    add_coverage(session, response, {})
    begin
      Portfolios::Generator.new(session: session, gemini_client: FakeGeminiClient.new(response)).call
    rescue StandardError
      # The generator marks the portfolio failed; it re-raises only for retryable errors.
      nil
    end

    { code: code, label: label, assessment: assessment, session: session,
      portfolio: session.reload.portfolio, vacancy: nil, report: nil }
  end

  # ---------------------------------------------------------------------------
  # Fake Gemini portfolio responses (string keys, as parsed from JSON)
  # ---------------------------------------------------------------------------

  def skill(label, level, confidence, code, evidence: nil, summary: nil)
    {
      'skill_label'        => label,
      'level'              => level,
      'confidence'         => confidence,
      'evidence'           => evidence || ["Kandidat Contoh #{code}: contoh kutipan tentang #{label}."],
      'competency_summary' => summary || "Contoh ringkasan kompetensi #{label}."
    }
  end

  def normal_response(code)
    {
      'configured_skills' => [
        skill('Ruby on Rails', 3, 'high', code),
        skill('SQL & Data Modeling', 2, 'medium', code),
        skill('API Design', 4, 'high', code),
        skill('System Design', 4, 'medium', code),
        skill('Komunikasi Teknis', 2, 'high', code)
      ],
      'discovered_skills' => [skill('Docker', 2, 'low', code)]
    }
  end

  def not_covered_response
    {
      'configured_skills' => [
        skill('Ruby on Rails', 3, 'high', 'B'),
        skill('SQL & Data Modeling', 3, 'high', 'B'),
        skill('API Design', 3, 'medium', 'B')
      ],
      'discovered_skills' => []
    }
  end

  def invalid_level_response
    {
      'configured_skills' => [
        skill('Ruby on Rails', nil, 'high', 'C'),
        skill('SQL & Data Modeling', 'L3', 'medium', 'C'),
        skill('API Design', 0, 'medium', 'C'),
        skill('System Design', 7, 'high', 'C'),
        skill('Komunikasi Teknis', 'tiga', 'high', 'C')
      ],
      'discovered_skills' => []
    }
  end

  def low_confidence_response
    {
      'configured_skills' => VACANCY_SKILLS.map { |label, _| skill(label, 2, 'low', 'D') },
      'discovered_skills' => []
    }
  end

  def long_text_response
    {
      'configured_skills' => [
        skill(LONG_LABEL, 2, 'medium', 'F', evidence: [LONG_EVIDENCE] * 3, summary: LONG_SUMMARY),
        skill('Ruby on Rails', 3, 'high', 'F')
      ],
      'discovered_skills' => [skill(LONG_LABEL.reverse, 3, 'low', 'F', summary: LONG_SUMMARY)]
    }
  end

  # Truncated JSON string, as if the model output was cut off mid-quote.
  def broken_json_response
    '{"configured_skills": [{"skill_label": "Ruby on Rails", "evidence": ' \
      '["Kandidat Contoh H: saya biasanya menulis migrasi yang'
  end

  def partial_write_response
    {
      'configured_skills' => [
        skill('Ruby on Rails', 3, 'high', 'I'),
        skill('SQL & Data Modeling', 3, 'very_high', 'I'),
        skill('API Design', 3, 'high', 'I')
      ],
      'discovered_skills' => []
    }
  end

  # ---------------------------------------------------------------------------
  # Record builders
  # ---------------------------------------------------------------------------

  def create_assessment(name, skill_labels)
    Assessment.create!(
      name: name, created_by: ASSESSOR_ID, time_limit_min: 30, language: 'id',
      assessment_skills_attributes: skill_labels.each_with_index.map do |label, index|
        { skill_label: label, display_order: index, is_custom: true,
          l1_anchor: 'Contoh anchor L1', l2_anchor: 'Contoh anchor L2', l3_anchor: 'Contoh anchor L3',
          l4_anchor: 'Contoh anchor L4', l5_anchor: 'Contoh anchor L5' }
      end
    )
  end

  def create_vacancy(role_title, skills)
    Vacancy.create!(
      role_title: role_title, created_by: ASSESSOR_ID,
      culture_dimensions: 'Contoh: kolaboratif, rapi dalam dokumentasi.',
      vacancy_skills_attributes: skills.map { |label, level| { skill_label: label, expected_level: level } }
    )
  end

  def create_session(assessment, code)
    session = Session.create!(
      assessment: assessment, status: 'ended', end_reason: 'all_covered',
      candidate_name: "Kandidat #{PREFIX} #{code}",
      started_at: 40.minutes.ago, ended_at: 10.minutes.ago, duration_seconds: 1800
    )
    session.transcript_turns.create!(turn_number: 1, speaker: 'ai', text: 'Contoh pertanyaan dari AI.')
    session.transcript_turns.create!(turn_number: 2, speaker: 'candidate', text: "Contoh jawaban Kandidat #{PREFIX} #{code}.")
    session
  end

  # Coverage maps drive which skills may be rated and their confidence (D-1, D-7).
  # Every skill in the fake response is covered with 3 probes unless overridden;
  # extra labels (e.g. vacancy skills never discussed) can be added via overrides.
  def add_coverage(session, response, overrides)
    skills = response.is_a?(Hash) ? response.values_at('configured_skills', 'discovered_skills') : [[], []]
    entries = skills[0].map { |s| [s['skill_label'], false] } + skills[1].map { |s| [s['skill_label'], true] }
    entries += (overrides.keys - entries.map(&:first)).map { |label| [label, false] }

    entries.each do |label, discovered|
      state, probes = overrides.fetch(label, ['covered', 3])
      session.coverage_maps.create!(skill_label: label, is_discovered: discovered, state: state, probe_count: probes)
    end
  end

  def add_override(portfolio, label, level, notes)
    skill = portfolio.portfolio_skills.find_by!(skill_label: label)
    PortfolioSkills::OverrideActions.new(skill, actor_id: ASSESSOR_ID).set(level: level, notes: notes)
  end

  def add_confirm(portfolio, label, notes)
    skill = portfolio.portfolio_skills.find_by!(skill_label: label)
    PortfolioSkills::OverrideActions.new(skill, actor_id: ASSESSOR_ID).confirm(notes: notes)
  end

  def print_summary(results)
    puts "\nDev scenarios seeded (#{results.size}):"
    results.each do |r|
      base = "/assessments/#{r[:assessment].id}/sessions/#{r[:session].id}"
      line = "  [#{r[:code]}] #{r[:label]} | tenant=#{r[:session].tenant_id} session=#{r[:session].id} " \
             "portfolio=#{r[:portfolio]&.id} status=#{r[:portfolio]&.generation_status} | #{base}/portfolio"
      line += " | #{base}/fitgap/#{r[:vacancy].id}" if r[:vacancy]
      puts line
    end
  end

  def print_pending_invite
    puts "  [pending] undangan belum dimulai | /assessments/#{@pending_invite.assessment_id}/invite" \
         " | /interview/#{@pending_invite.invite_token}"
  end
end

DevScenarios.run
