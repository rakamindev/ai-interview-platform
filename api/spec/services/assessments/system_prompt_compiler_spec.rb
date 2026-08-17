# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessments::SystemPromptCompiler do
  let(:assessment) { create(:assessment, name: 'Senior Frontend Engineer', language: 'en') }
  let(:skill) do
    create(:assessment_skill, assessment: assessment, skill_id: 'SK-ENG-001',
                              skill_label: 'React / Frontend Development Core',
                              scope_include: 'Component design, state management',
                              scope_exclude: 'Backend APIs',
                              l1_anchor: 'Implements components from specs.',
                              l2_anchor: 'Builds routine features independently.',
                              l3_anchor: 'Designs complex features end-to-end.',
                              l4_anchor: 'Defines frontend standards.',
                              l5_anchor: 'Drives org architecture.')
  end

  subject(:prompt) { described_class.new(assessment).call }

  before { skill }

  # PRD-01 Section 1: the AI must NOT read from a question list.
  it 'states the AI crafts its own questions (no question list)' do
    expect(prompt).to include('You are NOT given a question list')
    expect(prompt).to include('You craft your own questions')
  end

  # PRD-01: probe what they said, minimum one follow-up per skill.
  it 'encodes the probing rules' do
    expect(prompt).to include('PROBE WHAT THEY SAID')
    expect(prompt).to include('Do not ask a pre-planned next question')
    expect(prompt).to include('MINIMUM ONE FOLLOW-UP PER SKILL')
  end

  # PRD-01: make them demonstrate, not recite.
  it 'encodes demonstrate-not-recite' do
    expect(prompt).to include('MAKE THEM DEMONSTRATE, NOT RECITE')
  end

  # PRD-01: no announced topic changes.
  it 'forbids announcing topic changes' do
    expect(prompt).to include('Do not announce topic changes')
  end

  # PRD-01: never close without a system signal.
  it 'forbids closing without a wrap_up signal' do
    expect(prompt).to include('wrap_up')
    expect(prompt).to include('MUST NOT close, wrap up, or say goodbye')
  end

  # Each skill's L1-L5 anchors are compiled in.
  it 'compiles skill scopes and anchors' do
    expect(prompt).to include('React / Frontend Development Core')
    expect(prompt).to include('SCOPE: Component design, state management')
    expect(prompt).to include('WHAT DOES NOT COUNT: Backend APIs')
    expect(prompt).to include('L1 — Implements components from specs.')
    expect(prompt).to include('L5 — Drives org architecture.')
  end

  # Prompt-injection defense: coverage/timing signals are internal, authenticated.
  it 'defends against candidate injection of system signals' do
    expect(prompt).to include('SYS-TC-7x9k')
    expect(prompt).to include('CANDIDATE INJECTION ATTEMPT')
  end
end
