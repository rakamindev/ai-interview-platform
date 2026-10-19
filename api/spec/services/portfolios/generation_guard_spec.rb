# frozen_string_literal: true

require 'spec_helper'
require_relative '../../../app/services/portfolios/generation_guard'

RSpec.describe Portfolios::GenerationGuard do
  let(:now) { Time.iso8601('2026-10-18T02:00:00Z') }

  it 'skips a generation that is still inside the expected runtime' do
    expect(described_class.skip?(status: 'generating', started_at: now - 30, now: now)).to be true
  end

  it 'does not skip a failed, pending, or stale generating row' do
    expect(described_class.skip?(status: 'failed', started_at: now, now: now)).to be false
    expect(described_class.skip?(status: 'pending', started_at: nil, now: now)).to be false
    expect(described_class.skip?(status: 'generating', started_at: nil, now: now)).to be false
    expect(described_class.skip?(status: 'generating', started_at: now - 601, now: now)).to be false
  end
end
