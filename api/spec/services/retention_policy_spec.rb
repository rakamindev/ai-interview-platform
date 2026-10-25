# frozen_string_literal: true

require_relative '../spec_helper'
require_relative '../../app/services/retention_policy'

RSpec.describe RetentionPolicy do
  it 'archives vacancies whose Fit/Gap reports must be retained' do
    expect(described_class.vacancy_action(has_fit_gap_reports: true)).to eq(:archive)
  end

  it 'allows physical deletion only when a vacancy has no reports' do
    expect(described_class.vacancy_action(has_fit_gap_reports: false)).to eq(:delete)
  end

  it 'allows deleting pending invites but retains active and ended sessions' do
    expect(described_class.session_deletable?('pending')).to be(true)
    expect(described_class.session_deletable?('active')).to be(false)
    expect(described_class.session_deletable?('ended')).to be(false)
  end
end
