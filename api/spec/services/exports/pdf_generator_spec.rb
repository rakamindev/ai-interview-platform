# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Exports::PdfGenerator do
  let(:org) { create_organization(scheme: 'acme') }

  around { |example| as_tenant(org) { example.run } }

  let(:portfolio) { create(:portfolio) }

  it 'renders overrides, unrated skills and text outside Windows-1252' do
    rated = create(:portfolio_skill, portfolio:, skill_label: 'React → Hooks',
                                     evidence: [{ 'quote' => 'kita pakai useRef 🚀 supaya cepat', 'turn_number' => 4 }])
    create(:assessor_override, portfolio_skill: rated, override_level: 4)
    create(:portfolio_skill, :not_assessed, portfolio:, skill_label: 'System Design')

    pdf = described_class.new(portfolio:).call

    expect(pdf).to start_with('%PDF')
  end
end
