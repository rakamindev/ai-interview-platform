# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessment, :aggregate_failures, type: :model do
  subject(:assessment) do
    described_class.new(
      created_by: 7,
      language: 'en',
      name: 'Backend Engineer',
      time_limit_min: 30
    )
  end

  around do |example|
    Current.using(tenant_id: 42) { example.run }
  end

  it 'assigns the current tenant before validation' do
    expect(assessment).to be_valid
    expect(assessment.tenant_id).to eq(42)
  end

  it 'rejects unsupported time limits' do
    assessment.time_limit_min = 25

    expect(assessment).not_to be_valid
    expect(assessment.errors[:time_limit_min]).to be_present
  end

  it 'rejects unsupported languages' do
    assessment.language = 'fr'

    expect(assessment).not_to be_valid
    expect(assessment.errors[:language]).to be_present
  end
end
