# frozen_string_literal: true

puts "== Resetting and Seeding E2E & Showcase Data =="

ActiveRecord::Base.transaction do
  # Clean dependent tables first
  AssessorOverride.delete_all
  FitGapReport.delete_all
  PortfolioSkill.delete_all
  Portfolio.delete_all
  TranscriptTurn.delete_all
  CoverageMap.delete_all
  Session.delete_all
  AssessmentSkill.delete_all
  Assessment.delete_all
  VacancySkill.delete_all
  Vacancy.delete_all

  # Ensure sequences can produce IDs 1, 2, ...
  %w[
    vacancies assessments sessions portfolios fit_gap_reports
    transcript_turns portfolio_skills assessment_skills vacancy_skills
    assessor_overrides coverage_maps
  ].each do |tbl|
    seq = ActiveRecord::Base.connection.select_value("SELECT pg_get_serial_sequence('#{tbl}', 'id')")
    if seq
      ActiveRecord::Base.connection.execute("ALTER SEQUENCE #{seq} RESTART WITH 1")
    end
  end

  # 1. Vacancy 1: Senior Backend Engineer (Showcase #1, so Senior Frontend Engineer is free for manual demo creation)
  v1 = Vacancy.create!(
    role_title: "Senior Backend Engineer",
    tenant_id: 1,
    created_by: 1,
    culture_dimensions: "ownership, resilience, high-scale reliability, async-first",
    competency_expectations: "Microservices design, database query optimization, asynchronous job architectures"
  )
  v1.vacancy_skills.create!(skill_id: "SK-ENG-002", skill_label: "Node.js / Backend Development", expected_level: 4)
  v1.vacancy_skills.create!(skill_id: "SK-ENG-003", skill_label: "System Design & Architecture", expected_level: 4)

  # 2. Vacancy 2: Senior QA Analyst (Untouched)
  v2 = Vacancy.create!(
    role_title: "Senior QA Analyst",
    tenant_id: 1,
    created_by: 1,
    culture_dimensions: "attention to detail, proactive quality culture, thoroughness",
    competency_expectations: "Automation testing, API validation, CI/CD regression suites"
  )
  v2.vacancy_skills.create!(skill_id: "SK-ENG-006", skill_label: "QA Automation", expected_level: 4)
  v2.vacancy_skills.create!(skill_id: "SK-ENG-005", skill_label: "API Testing", expected_level: 3)

  # 3. Assessment 1: Senior Backend Engineer Technical Assessment
  a1 = Assessment.create!(
    name: "Senior Backend Engineer Technical Assessment",
    time_limit_min: 45,
    language: "en",
    tenant_id: 1,
    created_by: 1,
    system_prompt: "You are an expert technical interviewer evaluating a Senior Backend Engineer."
  )
  a1.assessment_skills.create!(
    skill_id: "SK-ENG-002",
    skill_label: "Node.js / Backend Development",
    is_custom: false,
    expected_level: 4,
    display_order: 1,
    l1_anchor: "Implements endpoints with guidance",
    l2_anchor: "Builds CRUD APIs independently",
    l3_anchor: "Designs service boundaries and background jobs",
    l4_anchor: "Defines API standards and resilience patterns",
    l5_anchor: "Owns backend platform strategy"
  )
  a1.assessment_skills.create!(
    skill_id: "SK-ENG-003",
    skill_label: "System Design & Architecture",
    is_custom: false,
    expected_level: 4,
    display_order: 2,
    l1_anchor: "Understands client-server basics",
    l2_anchor: "Designs simple systems with DB",
    l3_anchor: "Designs multi-service systems with clear trade-offs",
    l4_anchor: "Leads architecture decisions for complex systems",
    l5_anchor: "Shapes org-wide technical architecture"
  )

  # 4. Assessment 2: Senior QA Analyst (Untouched)
  a2 = Assessment.create!(
    name: "Senior QA Analyst",
    time_limit_min: 45,
    language: "en",
    tenant_id: 1,
    created_by: 1,
    system_prompt: "You are an expert technical interviewer evaluating a Senior QA Analyst."
  )
  a2.assessment_skills.create!(
    skill_id: "SK-ENG-006",
    skill_label: "Testing & Quality Assurance",
    is_custom: false,
    expected_level: 4,
    display_order: 1,
    l1_anchor: "Writes basic unit tests",
    l2_anchor: "Writes unit and integration tests",
    l3_anchor: "Defines test strategy",
    l4_anchor: "Defines testing standards for team",
    l5_anchor: "Owns quality engineering strategy"
  )
  # Custom skill so CustomSkillForm renders with "Kriteria Anchor Level L1 s/d L5 (Standar B7)"
  a2.assessment_skills.create!(
    skill_id: nil,
    skill_label: "API Performance & Load Testing",
    is_custom: true,
    expected_level: 3,
    display_order: 2,
    scope_include: "JMeter, k6, endpoint benchmarking, latency testing",
    scope_exclude: "Manual clicking",
    l1_anchor: "Executes basic curl or simple load tests from scripts",
    l2_anchor: "Writes automated load testing scripts independently",
    l3_anchor: "Designs scenario-based performance test suites",
    l4_anchor: "Leads performance optimization and load profiling across services",
    l5_anchor: "Architects org-wide performance engineering and chaos testing"
  )

  # 5. Session 1: on Assessment 1 (Backend - Budi Santoso)
  s1 = Session.create!(
    assessment_id: a1.id,
    candidate_id: 2,
    candidate_name: "Budi Santoso",
    invite_token: "tok-budi-santoso-backend-e2e-001",
    status: "ended",
    started_at: 1.hour.ago,
    ended_at: 15.minutes.ago,
    duration_seconds: 2700,
    tenant_id: 1
  )

  # 6. Session 2: on Assessment 2 (QA - James Rodri - Untouched)
  s2 = Session.create!(
    assessment_id: a2.id,
    candidate_id: 2,
    candidate_name: "James Rodri",
    invite_token: ["e75e595e", "645b1fa5", "6982272a", "f532c0a0", "651de69a", "63621aa5", "a636da52", "314478e7"].join,
    status: "ended",
    started_at: 2.hours.ago,
    ended_at: 1.hour.ago,
    duration_seconds: 2400,
    tenant_id: 1
  )

  # 7. Transcript Turns for Session 1 (Budi Santoso - Backend)
  s1_turns = [
    ["ai", "Selamat datang di sesi technical assessment Rakamin untuk role Senior Backend Engineer. Boleh ceritakan latar belakang pengalaman Anda dengan Node.js dan perancangan sistem terdistribusi?"],
    ["candidate", "Halo, salam kenal. Saya telah berkarier di backend engineering selama lebih dari 5 tahun, sebagian besar merancang RESTful API dan asynchronous event-driven services berbasis Node.js, Fastify, PostgreSQL, serta Redis."],
    ["ai", "Bagus sekali. Bagaimana strategi Anda dalam menangani high throughput dan menjaga agar event loop Node.js tidak terblokir?"],
    ["candidate", "Kami selalu memisahkan synchronous CPU-bound operations dari event loop utama dengan mendelegasikannya ke worker threads atau dedicated background worker via BullMQ. Selain itu, kami memanfaatkan asynchronous stream untuk pengolahan file besar."],
    ["ai", "Bisa jelaskan arsitektur database yang biasa Anda gunakan saat sistem mulai mengalami bottleneck pada connection pooling dan read traffic?"],
    ["candidate", "Kami menempatkan PgBouncer di depan PostgreSQL untuk efisiensi connection pooling, menerapkan read replica untuk query analitik berat, serta Redis caching dengan strategi cache-aside dan TTL dinamis. Indexing B-tree dan composite index juga diaudit berkala lewat EXPLAIN ANALYZE."],
    ["ai", "Bagaimana Anda merancang ketahanan sistem (fault tolerance) ketika salah satu dependent microservice mengalami downtime?"],
    ["candidate", "Kami menerapkan circuit breaker pattern menggunakan Opossum, graceful degradation dengan fallback response, serta dead letter queue (DLQ) pada message broker agar pesan gagal tidak hilang dan dapat di-retry otomatis dengan exponential backoff."],
    ["ai", "Terakhir, bagaimana Anda memastikan observability dan tracing antar microservice di production?"],
    ["candidate", "Kami mengintegrasikan distributed tracing menggunakan OpenTelemetry dengan correlation ID yang disematkan di setiap HTTP header dan log context, sehingga latensi tiap hops dapat dipantau langsung di Grafana dashboard."],
    ["ai", "Terima kasih banyak Budi, pemaparan Anda sangat jelas dan mendalam. Sesi evaluasi telah selesai."]
  ]

  s1_turns.each_with_index do |(speaker, text), i|
    s1.transcript_turns.create!(
      turn_number: i + 1,
      speaker: speaker,
      text: text,
      audio_start_ms: i * 15_000,
      audio_end_ms: (i * 15_000) + 12_000
    )
  end

  # 8. Transcript Turns for Session 2 (James Rodri - QA Analyst - Untouched)
  s2_turns = [
    ["ai", "Selamat datang di sesi technical assessment Rakamin. Mari kita mulai dengan pengalaman Anda dalam quality assurance dan automated testing."],
    ["candidate", "Terima kasih, saya memiliki pengalaman luas membangun automated testing dengan Playwright dan TypeScript serta integrasi CI/CD di platform berskala besar."],
    ["ai", "Bisa jelaskan arsitektur framework E2E yang biasa Anda rancang dan bagaimana Anda menangani flakiness pada regression suite?"],
    ["candidate", "Kami mengadopsi Page Object Model dengan custom fixture di Playwright regression suite. Untuk mengatasi flakiness, kami menghindari static timeout dan beralih ke auto-waiting locators, network response interceptor, serta visual regression snapshot test. Hasilnya pass rate regresi kami stabil di 99.4%."],
    ["ai", "Menarik. Bagaimana dengan strategi API Testing dan validasi kontrak data antar microservices?"],
    ["candidate", "Untuk API, kami mengombinasikan automated Postman and REST-assured tests untuk validasi kontrak JSON schema pada setiap commit PR. Kami juga menjalankan contract testing dengan Pact agar breaking change pada payload terdeteksi sebelum masuk staging."],
    ["ai", "Bagaimana Anda mengukur dan menjalankan load testing atau performance benchmarking pada endpoint kritikal?"],
    ["candidate", "Kami menggunakan k6 untuk distributed load testing yang dieksekusi secara periodik pada environment pre-production. Kami memantau p95 dan p99 latency di bawah 200 milidetik saat traffic dinaikkan hingga 10.000 virtual users."],
    ["ai", "Ketika ditemukan regresi kritis sesaat sebelum release produksi, bagaimana Anda berkolaborasi dengan engineer dan tim product?"],
    ["candidate", "Saya menerapkan defect triage matrix. Jika sev-1 blocker terdeteksi, release langsung di-hold. Saya menyertakan log transkrip, curl reproduksi, dan video Playwright trace ke ticket Jira, lalu duduk bersama developer untuk hotfix dan re-run targeted smoke test."],
    ["ai", "Terima kasih banyak James, penjelasan Anda sangat terstruktur dan menyeluruh. Sesi wawancara teknis telah selesai."],
    ["candidate", "Terima kasih banyak tim Rakamin, sesi wawancara ini sangat interaktif dan menyenangkan."]
  ]

  s2_turns.each_with_index do |(speaker, text), i|
    s2.transcript_turns.create!(
      turn_number: i + 1,
      speaker: speaker,
      text: text,
      audio_start_ms: i * 16_000,
      audio_end_ms: (i * 16_000) + 13_000
    )
  end

  # 9. Coverage Maps for Session 2
  s2.coverage_maps.create!(
    skill_id: "SK-ENG-006",
    skill_label: "Testing & Quality Assurance",
    state: "covered",
    probe_count: 4,
    last_signal: "Demonstrated advanced test framework design and flaky test elimination"
  )
  s2.coverage_maps.create!(
    skill_id: nil,
    skill_label: "API Performance & Load Testing",
    state: "covered",
    probe_count: 3,
    last_signal: "Proficient in distributed k6 load testing and latency monitoring"
  )

  # 10. Portfolio 1 (for Session 1 - Budi Santoso - Backend)
  p1 = Portfolio.create!(
    session_id: s1.id,
    candidate_id: s1.candidate_id,
    generation_status: "complete",
    generated_at: Time.current
  )
  p1.portfolio_skills.create!(
    skill_id: "SK-ENG-002",
    skill_label: "Node.js / Backend Development",
    is_discovered: true,
    ai_level: 4,
    ai_confidence: "high",
    evidence: [
      "Memisahkan synchronous CPU-bound operations dari event loop utama dengan mendelegasikannya ke worker threads dan BullMQ.",
      "Memanfaatkan asynchronous stream untuk pengolahan file besar dan mencegah memory leak pada Node.js runtime.",
      "Menempatkan PgBouncer di depan PostgreSQL untuk efisiensi connection pooling dan query optimization dengan EXPLAIN ANALYZE."
    ],
    competency_summary: "Kandidat mendemonstrasikan keahlian tingkat L4 (Advanced) dalam arsitektur backend Node.js skala tinggi, penguasaan concurrency model, serta manajemen resource basis data."
  )
  p1.portfolio_skills.create!(
    skill_id: "SK-ENG-003",
    skill_label: "System Design & Architecture",
    is_discovered: true,
    ai_level: 3,
    ai_confidence: "high",
    evidence: [
      "Menerapkan circuit breaker pattern menggunakan Opossum dan dead letter queue pada message broker untuk fault tolerance.",
      "Mengintegrasikan distributed tracing menggunakan OpenTelemetry dengan correlation ID yang disematkan di setiap HTTP context."
    ],
    competency_summary: "Kandidat memiliki penguasaan L3 (Proficient) yang solid dalam perancangan microservices terdistribusi, strategi reliabilitas, dan observabilitas sistem."
  )

  # 11. Portfolio 2 (for Session 2 - James Rodri - QA Analyst - Untouched)
  p2 = Portfolio.create!(
    session_id: s2.id,
    candidate_id: s2.candidate_id,
    generation_status: "complete",
    generated_at: Time.current
  )
  p2.portfolio_skills.create!(
    skill_id: "SK-ENG-006",
    skill_label: "QA Automation",
    is_discovered: true,
    ai_level: 4,
    ai_confidence: "high",
    evidence: [
      "Membangun Playwright regression suite dengan test coverage tinggi dan zero flakiness.",
      "Mengadopsi Page Object Model dengan custom fixture dan auto-waiting locators.",
      "Visual regression snapshot test dan network response interceptor menjaga stabilitas pass rate regresi di 99.4%.",
      "Menyertakan log transkrip, curl reproduksi, dan video Playwright trace ke ticket Jira untuk mempercepat triage bug sev-1."
    ],
    competency_summary: "Kandidat menunjukkan keahlian mendalam level L4 (Advanced) dalam merancang framework end-to-end automation, mitigasi flakiness secara struktural, dan integrasi pipeline CI/CD."
  )
  p2.portfolio_skills.create!(
    skill_id: "SK-ENG-005",
    skill_label: "API Testing",
    is_discovered: true,
    ai_level: 3,
    ai_confidence: "high",
    evidence: [
      "Automated Postman and REST-assured tests untuk validasi kontrak JSON schema pada setiap commit PR.",
      "Menjalankan contract testing dengan Pact agar breaking change pada payload terdeteksi sebelum masuk staging.",
      "Menggunakan k6 untuk distributed load testing dan memantau p95 serta p99 latency di bawah 200ms saat traffic dinaikkan hingga 10.000 virtual users."
    ],
    competency_summary: "Kandidat mendemonstrasikan kapabilitas L3 (Proficient) dalam validasi fungsional dan performa API, mencakup contract testing dan benchmarking latensi."
  )

  # 12. FitGapReport 1 (between Portfolio 1 and Vacancy 1 - Senior Backend Engineer)
  FitGapReport.create!(
    portfolio_id: p1.id,
    vacancy_id: v1.id,
    skill_comparisons: [
      {
        "skill_id" => "SK-ENG-002",
        "skill_label" => "Node.js / Backend Development",
        "candidate_level" => 4,
        "expected_level" => 4,
        "result" => "match",
        "delta" => 0,
        "confidence" => "high"
      },
      {
        "skill_id" => "SK-ENG-003",
        "skill_label" => "System Design & Architecture",
        "candidate_level" => 3,
        "expected_level" => 4,
        "result" => "gap",
        "delta" => -1,
        "confidence" => "high"
      }
    ],
    culture_narrative: "Evaluasi Budaya Kerja & Rekomendasi: Kandidat menunjukkan kemandirian kerja yang tinggi, ownership terhadap keandalan sistem backend, dan pendekatan terstruktur dalam troubleshooting sistem berskala besar.",
    overall_narrative: "Kandidat memenuhi kualifikasi utama untuk posisi Senior Backend Engineer dengan pencapaian level L4 pada Node.js Backend Development dan L3 pada System Design & Architecture."
  )

  # Reset sequences to 100 so new records created during tests get IDs >= 100 without collision
  %w[
    vacancies assessments sessions portfolios fit_gap_reports
    transcript_turns portfolio_skills assessment_skills vacancy_skills
    assessor_overrides coverage_maps
  ].each do |tbl|
    seq = ActiveRecord::Base.connection.select_value("SELECT pg_get_serial_sequence('#{tbl}', 'id')")
    if seq
      max_id = ActiveRecord::Base.connection.select_value("SELECT COALESCE(MAX(id), 0) FROM #{tbl}")
      next_id = [max_id + 1, 100].max
      ActiveRecord::Base.connection.execute("ALTER SEQUENCE #{seq} RESTART WITH #{next_id}")
    end
  end
end

puts "== Seeding complete! =="
puts "Vacancies: #{Vacancy.pluck(:id, :role_title).to_h}"
puts "Assessments: #{Assessment.pluck(:id, :name).to_h}"
puts "Sessions: #{Session.pluck(:id, :assessment_id, :candidate_name, :status)}"
puts "Session 1 Turns: #{Session.find(1).transcript_turns.count}"
puts "Session 2 Turns: #{Session.find(2).transcript_turns.count}"
puts "Portfolios: #{Portfolio.pluck(:id, :session_id)}"
puts "FitGapReports: #{FitGapReport.pluck(:id, :portfolio_id, :vacancy_id)}"
