# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Exports::PdfGenerator do
  let(:assessment) { create(:assessment, name: 'Fullstack Developer') }
  let(:session)    { create(:session, :ended, assessment: assessment) }
  let(:portfolio)  { create(:portfolio, :complete, session: session) }

  def render = described_class.new(portfolio: portfolio).call

  it 'produces a PDF' do
    create(:portfolio_skill, portfolio: portfolio)

    expect(render).to start_with('%PDF')
  end

  # Prawn's built-in fonts are Windows-1252 only. Before, an assessor override
  # put a "→" on the page and every export of that portfolio returned 500.
  describe 'text outside Windows-1252' do
    it 'still renders when an assessor override is present' do
      skill = create(:portfolio_skill, portfolio: portfolio, ai_level: 2)
      create(:assessor_override, portfolio_skill: skill, ai_level: 2, override_level: 3)

      expect { render }.not_to raise_error
    end

    it 'survives model output containing unsupported glyphs' do
      create(:portfolio_skill, portfolio: portfolio,
                               competency_summary: 'Ships fast → iterates ⭐ reliably 🚀')

      expect { render }.not_to raise_error
    end

    it 'survives an assessor note containing unsupported glyphs' do
      skill = create(:portfolio_skill, portfolio: portfolio)
      create(:assessor_override, portfolio_skill: skill, assessor_notes: 'Raised L2 → L3 ✅')

      expect { render }.not_to raise_error
    end
  end

  describe 'a skill the interview never assessed' do
    before do
      create(:portfolio_skill, portfolio: portfolio, skill_label: 'Never Probed',
                               assessed: false, ai_level: nil, ai_confidence: nil,
                               competency_summary: nil, evidence: [])
    end

    # Only that the nil level does not blow the export up. That the level is nil
    # in the first place is locked in Portfolios::Generator's spec — asserting it
    # again here would need the rendered text back out of a compressed PDF.
    it 'renders instead of raising on the missing level' do
      expect { render }.not_to raise_error
    end
  end

  describe '#pdf_safe' do
    subject(:safe) { described_class.new(portfolio: portfolio).send(:pdf_safe, input) }

    context 'with a glyph that has a sensible ASCII equivalent' do
      let(:input) { 'L2 → L3' }

      it 'transliterates rather than dropping meaning' do
        expect(safe).to eq('L2 -> L3')
      end
    end

    context 'with a glyph that has none' do
      let(:input) { 'shipped 🚀 today' }

      it 'replaces it so the render cannot fail' do
        expect(safe).to eq('shipped ? today')
      end
    end

    context 'with characters Windows-1252 already covers' do
      let(:input) { 'café — naïve • 50%' }

      it 'leaves them untouched' do
        expect(safe).to eq('café — naïve • 50%')
      end
    end

    context 'with nil' do
      let(:input) { nil }

      it 'returns an empty string' do
        expect(safe).to eq('')
      end
    end
  end
end
