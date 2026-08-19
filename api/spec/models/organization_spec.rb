# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Organization, type: :model do
  it 'is valid from the factory' do
    organization = build(:organization)

    expect(organization).to be_valid
  end

  it 'is findable by scheme via .identify' do
    organization = create(:organization)

    expect(Organization.identify(organization.scheme)).to eq(organization)
  end
end
