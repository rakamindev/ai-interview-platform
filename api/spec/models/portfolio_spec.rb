# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolio, type: :model do
  describe 'generation statuses' do
    it 'exposes the unverifiable status' do
      expect(described_class::GENERATION_STATUSES).to include('unverifiable')
    end

    it 'rejects statuses outside the allowlist' do
      expect(described_class::GENERATION_STATUSES).not_to include('bogus')
    end

    it 'answers unverifiable? for an unverifiable portfolio' do
      portfolio = described_class.new(generation_status: 'unverifiable')
      expect(portfolio.unverifiable?).to be true
      expect(portfolio.complete?).to be false
      expect(portfolio.failed?).to be false
      expect(portfolio.generating?).to be false
    end
  end
end