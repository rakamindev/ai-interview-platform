# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Exports::PdfGenerator do
  it 'includes the effective finalized decision and its source context' do
    portfolio = create(:portfolio)
    create(:portfolio_skill, portfolio:)
    decision = create(:portfolio_decision, portfolio:, ai_outcome: 'fail')
    decision.update!(
      final_outcome: 'pass',
      finalization_note: 'Admin reviewed the transcript evidence and approved the candidate.',
      finalized_by_id: 7,
      finalized_at: Time.current
    )

    pdf = described_class.new(portfolio:).call
    pdf_stream = pdf.force_encoding('ASCII-8BIT')

    expect(pdf_stream).to include("<#{'Overall Decision'.unpack1('H*')}>")
    expect(pdf_stream).to include("<#{'Final outcome: P'.unpack1('H*')}>")
    expect(pdf_stream).to include("<#{'AI recommendation: F'.unpack1('H*')}>")
    expect(pdf_stream).to include("<#{'Finalization note: Admin re'.unpack1('H*')}>")
  end
end
