# frozen_string_literal: true

RSpec.describe FitGap::ComparisonBuilder do
  let(:requirement_type) { Struct.new(:skill_id, :skill_label, :expected_level, keyword_init: true) }
  let(:skill_type) do
    Struct.new(:id, :skill_id, :skill_label, :ai_level, :ai_confidence, :evidence,
               :assessor_override, keyword_init: true) do
      def evidence_quotes = evidence
    end
  end
  let(:coverage_type) { Struct.new(:skill_id, :skill_label, :state, :probe_count, keyword_init: true) }
  let(:requirement) { requirement_type.new(skill_id: 'SK-ENG-001', skill_label: 'React', expected_level: 3) }
  let(:quotes) { ['I measured rerenders with the Profiler.', 'I used memoization to reduce rerenders.'] }
  let(:candidate_turns) { quotes }
  let(:skill) do
    skill_type.new(id: 42, skill_id: 'SK-ENG-001', skill_label: 'React', ai_level: 2,
                   ai_confidence: 'medium', evidence: quotes)
  end
  let(:coverage) { coverage_type.new(skill_id: 'SK-ENG-001', skill_label: 'React', state: 'partial', probe_count: 2) }

  def compare(skills: [skill], requirements: [requirement], maps: [coverage], turns: candidate_turns)
    described_class.new(vacancy_skills: requirements, portfolio_skills: skills,
                        coverage_maps: maps, candidate_turns: turns).call
  end

  it 'computes a signed gap only from verified evidence and probing' do
    result = compare.first

    expect(result).to include(required_level: 3, candidate_level: 2, delta: -1,
                              result: 'gap', assessment_state: 'assessed', evidence_count: 2)
  end

  it 'uses a human override while retaining the AI level' do
    skill.assessor_override = Struct.new(:override_level).new(3)

    expect(compare.first).to include(candidate_level: 3, ai_level: 2, delta: 0,
                                     result: 'match', is_override: true)
  end

  it 'does not turn an absent skill into a gap' do
    expect(compare(skills: []).first).to include(result: 'not_assessed',
                                                  assessment_state: 'not_assessed',
                                                  candidate_level: nil, delta: nil)
  end

  it 'qualifies a rating when a quote cannot be verified against candidate turns' do
    result = compare(turns: [quotes.first]).first

    expect(result).to include(result: 'not_assessed', assessment_state: 'insufficient_evidence',
                              candidate_level: nil, delta: nil, evidence_count: 1)
  end

  it 'does not count a repeated quote as independent evidence' do
    skill.evidence = [quotes.first, quotes.first]

    expect(compare.first).to include(result: 'not_assessed', evidence_count: 1,
                                     assessment_state: 'insufficient_evidence')
  end

  it 'does not rate a candidate from two tiny fragments of one answer' do
    skill.evidence = ['I', 'a']

    expect(compare(turns: ['I am a React developer.']).first)
      .to include(result: 'not_assessed', candidate_level: nil, evidence_count: 0)
  end

  it 'counts two substantive snippets of one answer as only one evidence turn' do
    combined = "#{quotes.first} #{quotes.last}"

    expect(compare(turns: [combined]).first)
      .to include(result: 'not_assessed', candidate_level: nil, evidence_count: 1)
  end

  it 'rejects duplicate vacancy labels instead of silently discarding one' do
    duplicate = requirement_type.new(skill_id: 'SK-ENG-099', skill_label: ' react ', expected_level: 4)

    expect { compare(requirements: [requirement, duplicate]) }.to raise_error(ArgumentError, /Duplicate/)
  end

  it 'rejects an ID and label conflict' do
    requirement.skill_id = 'SK-ENG-OTHER'

    expect { compare }.to raise_error(ArgumentError, /Conflicting/)
  end

  it 'rejects a matching ID paired with a conflicting label' do
    skill.skill_label = 'Vue'

    expect { compare }.to raise_error(ArgumentError, /Conflicting/)
  end
end
