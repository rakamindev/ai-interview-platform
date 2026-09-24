# frozen_string_literal: true

require_relative '../../spec_helper'
require_relative '../../../app/services/portfolios/evidence_validator'

RSpec.describe Portfolios::EvidenceValidator do
  Turn = Struct.new(:id, :speaker, :text)

  let(:turns) do
    [
      Turn.new(11, 'candidate', 'I designed the payment service for peak traffic.'),
      Turn.new(12, 'candidate', 'We reduced latency by adding a cache and measuring p95.')
    ]
  end
  let(:validator) { described_class.new(turns:) }
  let(:payload) do
    {
      'level' => 3,
      'confidence' => 'medium',
      'evidence' => ['designed the payment service', 'reduced latency by adding a cache'],
      'competency_summary' => 'Explains a design and validates its impact.'
    }
  end

  it 'accepts two exact quotes sourced from distinct candidate turns' do
    result = validator.validate(payload)

    expect(result[:assessment_status]).to eq('assessed')
    expect(result[:ai_level]).to eq(3)
    expect(result[:evidence].map { |item| item[:turn_id] }).to eq([11, 12])
  end

  it 'does not coerce strings, booleans, or out-of-range ratings' do
    ['3', true, 0, 6, 2.5].each do |invalid_level|
      result = validator.validate(payload.merge('level' => invalid_level))
      expect(result[:assessment_status]).to eq('not_assessed')
      expect(result[:ai_level]).to be_nil
    end
  end

  it 'rejects fabricated evidence and evidence repeated from one turn' do
    fabricated = validator.validate(payload.merge('evidence' => ['I led a global team', 'reduced latency by adding a cache']))
    repeated = validator.validate(payload.merge('evidence' => ['designed the payment service', 'peak traffic']))

    expect(fabricated[:assessment_reason]).to eq('invalid_evidence')
    expect(repeated[:assessment_reason]).to eq('insufficient_evidence')
  end

  it 'rejects an oversized quote instead of truncating its source silently' do
    result = validator.validate(payload.merge('evidence' => ['x' * 501, 'reduced latency by adding a cache']))
    expect(result[:assessment_reason]).to eq('invalid_evidence')
  end
end
