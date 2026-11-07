# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Exports::PdfGenerator do
  let(:organization) do
    Organization.create!(name: 'Test Corp', scheme: 'test-corp', identifier: 'test-corp', host: 'test.example.test')
  end
  let(:assessment) do
    Assessment.unscoped.create!(tenant_id: organization.id, created_by: 1, name: 'PDF', time_limit_min: 45, language: 'en')
  end
  let(:session) do
    Session.unscoped.create!(tenant_id: organization.id, assessment: assessment, status: 'ended', end_reason: 'error')
  end
  let!(:portfolio) { session.create_portfolio!(generation_status: 'complete', generated_at: Time.current) }
  let(:texts) { [] }

  before do
    original = Prawn::Document.instance_method(:text)
    collected = texts
    allow_any_instance_of(Prawn::Document).to receive(:text) do |doc, string, options = {}|
      collected << string
      original.bind(doc).call(string, options)
    end
  end

  it 'warns on the report when the portfolio was built without coverage' do
    session.coverage_maps.create!(skill_label: 'Testing', state: 'not_yet', probe_count: 0)

    described_class.new(portfolio: portfolio).call

    expect(texts.join(' ')).to include('Coverage data is missing')
  end

  it 'does not warn when coverage exists' do
    session.coverage_maps.create!(skill_label: 'Testing', state: 'partial', probe_count: 2)

    described_class.new(portfolio: portfolio).call

    expect(texts.join(' ')).not_to include('Coverage data is missing')
  end
end
