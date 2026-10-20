# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Exports::PdfGenerator do
  let(:organization) { Organization.create!(name: 'PDF Org', scheme: 'pdforg', identifier: 'pdforg', host: 'pdforg.test') }
  let(:assessment) do
    Assessment.create!(
      tenant_id: organization.id,
      created_by: 1,
      name: 'Senior Ruby Engineer (日本語・عربي)',
      time_limit_min: 30
    )
  end
  let(:session) do
    Session.create!(
      tenant_id: organization.id,
      assessment: assessment,
      invite_token: SecureRandom.hex(16),
      status: :ended,
      duration_seconds: 1200
    )
  end
  let(:portfolio) { Portfolio.create!(session: session) }

  describe '#call (EXP-01)' do
    it 'renders PDF with multi-byte Unicode strings, smart quotes, bullets, and non-Latin typography without error' do
      PortfolioSkill.create!(
        portfolio: portfolio,
        skill_label: 'Architecture & System Design (システム設計)',
        ai_level: 4,
        ai_confidence: 'high',
        competency_summary: 'Demonstrated deep knowledge with “smart quotes” and ‘apostrophes’. Candidate said: “Saya siap memimpin tim di Jakarta.”',
        evidence: [
          '“Quote with smart punctuation and bullet points”',
          'Candidate used microservices architecture (日本語・カタカナ) successfully.'
        ]
      )

      generator = described_class.new(portfolio: portfolio)
      expect {
        pdf_bytes = generator.call
        expect(pdf_bytes).to be_present
        expect(pdf_bytes[0..3]).to eq('%PDF')
      }.not_to raise_error
    end
  end

  describe 'explicit Not Assessed label (EXP-02)' do
    it 'renders Level: Not Assessed when skill effective level is nil' do
      unassessed_skill = PortfolioSkill.create!(
        portfolio: portfolio,
        skill_label: 'Cloud Infrastructure & Kubernetes',
        ai_level: nil,
        ai_confidence: nil,
        competency_summary: nil,
        evidence: []
      )

      pdf_doc = double('Prawn::Document').as_null_object
      allow(pdf_doc).to receive(:font_size).and_yield

      expect(pdf_doc).to receive(:text).with(include('Level: Not Assessed'))

      described_class.new(portfolio: portfolio).send(:render_skill_card, pdf_doc, unassessed_skill)
    end
  end

  describe 'explicit timezone rendering (TIME-01)' do
    it 'renders generated timestamp with explicit timezone identifier' do
      pdf_doc = double('Prawn::Document').as_null_object
      allow(pdf_doc).to receive(:font_size).and_yield

      expect(pdf_doc).to receive(:text).with(include("Generated: #{Time.current.strftime('%Y-%m-%d %H:%M %Z')}"))

      described_class.new(portfolio: portfolio).send(:render_header, pdf_doc)
    end
  end
end
