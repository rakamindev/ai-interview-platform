# frozen_string_literal: true

require 'spec_helper'
require 'time'
require_relative '../../../app/services/fit_gap/job_claim'

RSpec.describe FitGap::JobClaim do
  let(:now) { Time.iso8601('2026-10-18T02:00:00Z') }

  it 'treats a claim inside the ttl as fresh' do
    claims = { 'fitgap:9' => (now - 30).iso8601 }

    expect(described_class.fresh?(claims, 'fitgap:9', now: now, ttl_seconds: 180)).to be true
  end

  it 'lets a stale or malformed claim through so a crashed job can be retried' do
    stale = { 'fitgap:9' => (now - 181).iso8601 }

    expect(described_class.fresh?(stale, 'fitgap:9', now: now, ttl_seconds: 180)).to be false
    expect(described_class.fresh?({ 'fitgap:9' => 'yesterday' }, 'fitgap:9', now: now)).to be false
    expect(described_class.fresh?({}, 'fitgap:9', now: now)).to be false
  end
end
