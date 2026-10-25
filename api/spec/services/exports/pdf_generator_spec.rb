# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Exports::PdfGenerator do
  let(:pdf) do
    instance_double(Prawn::Document, text: nil, move_down: nil, stroke: nil, stroke_color: nil, horizontal_rule: nil)
  end
  let(:skill) do
    instance_double(
      PortfolioSkill,
      skill_label: 'React', ai_level: 3, ai_confidence: 'high', competency_summary: 'Summary',
      assessor_override: nil, evidence_items:, evidence_status:
    )
  end
  let(:generator) { described_class.allocate }

  before do
    allow(pdf).to receive(:font_size).and_yield
    allow(pdf).to receive(:stroke).and_yield
  end

  context 'with verified evidence' do
    let(:evidence_status) { 'verified' }
    let(:evidence_items) do
      [{ 'turn_number' => 6, 'quote' => 'Canonical candidate evidence', 'verification_status' => 'verified' }]
    end

    it 'prints the canonical quote with transcript provenance' do
      generator.send(:render_skill_card, pdf, skill)

      expect(pdf).to have_received(:text).with(
        '  - "Canonical candidate evidence" (Verified transcript turn 6)'
      )
    end
  end

  context 'with legacy evidence' do
    let(:evidence_status) { 'legacy' }
    let(:evidence_items) do
      [{ 'quote' => 'Detached historical text', 'verification_status' => 'legacy' }]
    end

    it 'labels the text without presenting it as a verified quotation' do
      generator.send(:render_skill_card, pdf, skill)

      expect(pdf).to have_received(:text).with(
        '  - Legacy evidence - transcript link unavailable: Detached historical text'
      )
    end
  end
end
