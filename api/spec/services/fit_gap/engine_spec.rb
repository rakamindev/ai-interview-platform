# frozen_string_literal: true

require "rails_helper"

RSpec.describe FitGap::Engine do
  let(:gemini_client) { double("GeminiClient", generate_content: { "culture_narrative" => "c", "overall_narrative" => "o" }) }

  let(:portfolio) do
    create(:portfolio).tap do |p|
      create(:portfolio_skill, portfolio: p, skill_label: "Ruby", ai_level: 3)
      create(:portfolio_skill, portfolio: p, skill_label: "Go", ai_level: 2)
    end
  end

  let(:vacancy) do
    create(:vacancy).tap do |v|
      create(:vacancy_skill, vacancy: v, skill_label: "Ruby", expected_level: 3)
      create(:vacancy_skill, vacancy: v, skill_label: "Go", expected_level: 4)
      create(:vacancy_skill, vacancy: v, skill_label: "Python", expected_level: 2)
    end
  end

  subject(:engine) { described_class.new(portfolio:, vacancy:, gemini_client:) }

  describe "#call" do
    let(:report) { engine.call }

    it "emits expected_level (not required_level) per comparison" do
      expect(report.skill_comparisons.first).to have_key("expected_level")
      expect(report.skill_comparisons.first).not_to have_key("required_level")
    end

    it "emits overridden flag, false by default for skills without an override" do
      ruby = report.skill_comparisons.find { |c| c["skill_label"] == "Ruby" }
      expect(ruby["overridden"]).to eq(false)
    end

    it "sets a 16-char source_fingerprint on the report" do
      expect(report.source_fingerprint).to be_a(String)
      expect(report.source_fingerprint.length).to eq(16)
    end

    it "persists skill_comparisons even when Gemini narrative generation fails (AC10)" do
      failing_client = double("GeminiClient")
      allow(failing_client).to receive(:generate_content).and_raise(StandardError, "Gemini down")
      report = described_class.new(portfolio:, vacancy:, gemini_client: failing_client).call

      expect(report).to be_persisted
      expect(report.skill_comparisons).to be_present
      expect(report.culture_narrative).to be_nil
      expect(report.overall_narrative).to be_present
    end
  end

  describe "overridden propagation" do
    it "marks the comparison overridden when an AssessorOverride exists" do
      skill = portfolio.portfolio_skills.find_by(skill_label: "Ruby")
      create(:assessor_override, portfolio_skill: skill, override_level: 5)

      report = described_class.new(portfolio:, vacancy:, gemini_client:).call
      ruby = report.skill_comparisons.find { |c| c["skill_label"] == "Ruby" }

      expect(ruby["overridden"]).to eq(true)
      expect(ruby["candidate_level"]).to eq(5)
    end
  end

  describe "#compute_fingerprint" do
    it "changes when an override is added (AC8 stale detection)" do
      f1 = described_class.new(portfolio:, vacancy:, gemini_client:).send(:compute_fingerprint)

      skill = portfolio.portfolio_skills.find_by(skill_label: "Ruby")
      create(:assessor_override, portfolio_skill: skill, override_level: 5, overridden_at: 1.second.from_now)

      f2 = described_class.new(portfolio:, vacancy:, gemini_client:).send(:compute_fingerprint)

      expect(f1).not_to eq(f2)
    end

    it "changes when a portfolio skill level changes" do
      f1 = described_class.new(portfolio:, vacancy:, gemini_client:).send(:compute_fingerprint)

      skill = portfolio.portfolio_skills.find_by(skill_label: "Ruby")
      skill.update!(ai_level: 5)

      f2 = described_class.new(portfolio:, vacancy:, gemini_client:).send(:compute_fingerprint)

      expect(f1).not_to eq(f2)
    end
  end

  describe "advisory lock key determinism" do
    it "produces a deterministic 64-bit integer consistent across separate processes" do
      engine1 = described_class.new(portfolio:, vacancy:, gemini_client:)
      engine2 = described_class.new(portfolio:, vacancy:, gemini_client:)

      expect(engine1.send(:advisory_lock_key)).to eq(engine2.send(:advisory_lock_key))
      expect(engine1.send(:advisory_lock_key)).to be_a(Integer)

      # Deterministic check matching external process calculation
      subshell_key = `ruby -r digest -e 'puts Digest::SHA256.digest("fitgap:#{portfolio.id}:#{vacancy.id}")[0...8].unpack1("q>")'`.strip.to_i
      expect(engine1.send(:advisory_lock_key)).to eq(subshell_key)
    end
  end

  # AC9: generation must be idempotent under concurrent execution. Two threads
  # racing on the same (portfolio, vacancy) pair must yield exactly one row and
  # never raise RecordNotUnique. The advisory lock serializes them.
  # use_transactional_tests is disabled so the rows committed by one thread are
  # visible to the other (a rolled-back outer transaction would hide them).
  describe "concurrent generation (AC9 idempotency)" do
    self.use_transactional_tests = false

    let!(:portfolio) do
      create(:portfolio).tap do |p|
        create(:portfolio_skill, portfolio: p, skill_label: "Ruby", ai_level: 3)
      end
    end
    let!(:vacancy) do
      create(:vacancy).tap do |v|
        create(:vacancy_skill, vacancy: v, skill_label: "Ruby", expected_level: 3)
      end
    end

    after do
      FitGapReport.where(portfolio_id: portfolio.id, vacancy_id: vacancy.id).delete_all
      VacancySkill.where(vacancy_id: vacancy.id).delete_all
      PortfolioSkill.where(portfolio_id: portfolio.id).delete_all
      Vacancy.where(id: vacancy.id).delete_all
      Portfolio.where(id: portfolio.id).delete_all
    end

    it "produces exactly one report row with no RecordNotUnique when two calls race" do
      errors = []
      threads = 2.times.map do
        Thread.new do
          begin
            described_class.new(
              portfolio: portfolio,
              vacancy:   vacancy,
              gemini_client: double("GeminiClient", generate_content: {
                "culture_narrative" => "c", "overall_narrative" => "o"
              })
            ).call
          rescue StandardError => e
            errors << e
          end
        end
      end
      threads.each(&:join)

      expect(errors).to be_empty
      expect(
        FitGapReport.where(portfolio_id: portfolio.id, vacancy_id: vacancy.id).count
      ).to eq(1)
    end
  end
end
