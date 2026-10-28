# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Api::V1::PortfoliosController, type: :controller do
  include InterviewHelpers

  let!(:interview) { create_interview }
  let(:portfolio) do
    interview.session.create_portfolio!(
      generation_status:      'generating',
      generation_started_at:  20.minutes.ago
    )
  end

  def reconcile(record)
    controller = described_class.new
    controller.instance_variable_set(:@portfolio, record)
    controller.send(:reconcile_stale_generation)
  end

  it 'flips a stale generating row to failed so the assessor gets the retry affordance' do
    reconcile(portfolio)
    portfolio.reload

    expect(portfolio.generation_status).to eq('failed')
    expect(portfolio.generation_error).to include('timed out')
  end

  it 'leaves a fresh generating row alone' do
    portfolio.update!(generation_started_at: Time.current)

    reconcile(portfolio)

    expect(portfolio.reload.generation_status).to eq('generating')
    expect(portfolio.generation_error).to be_nil
  end
end
