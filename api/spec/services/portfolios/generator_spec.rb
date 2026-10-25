# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Portfolios::Generator do
  around do |example|
    Current.using(tenant_id: 1) { example.run }
  end

  let(:assessment) { Assessment.create!(name: 'Backend Intern', time_limit_min: 30, created_by: 1) }
  let(:session)    { Session.create!(assessment: assessment, status: 'ended', end_reason: 'all_covered') }
  let(:client)     { double('gemini_client', generate_content: '{}') }

  before do
    allow_any_instance_of(described_class).to receive(:build_prompt).and_return('prompt')
    allow_any_instance_of(described_class).to receive(:save_skills)
  end

  it 'clears an error left by a previous failed attempt once generation succeeds' do
    portfolio = Portfolio.create!(
      session: session,
      generation_status: 'failed',
      generation_error: 'Gemini API timeout after 180s'
    )

    described_class.new(session: session, gemini_client: client).call

    expect(portfolio.reload).to have_attributes(generation_status: 'complete', generation_error: nil)
  end
end
