# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Exports::PdfGenerator do
  describe '#call' do
    it 'renders a PDF even when content contains characters outside the WinAnsi range' do
      assessment = Assessment.create!(tenant_id: 1, created_by: 1, name: 'React Embedded Portfolio', time_limit_min: 30)
      session    = Session.create!(tenant_id: 1, assessment: assessment, status: 'ended')
      portfolio  = Portfolio.create!(session: session, candidate_id: 1, generation_status: 'complete')

      portfolio.portfolio_skills.create!(
        skill_label:        'Backend Engineering',
        is_discovered:      false,
        ai_level:           3,
        ai_confidence:      'high',
        evidence:           ['응응 the candidate designed the schema', 'Sí sí the approach was sound'],
        competency_summary: 'Kandidat menguasai 水 dan 응 dengan baik ketika menghadapi scope ambigu.'
      )

      pdf = described_class.new(portfolio: portfolio).call

      expect(pdf).to start_with('%PDF')
      expect(pdf.bytesize).to be > 1000
    end
  end
end