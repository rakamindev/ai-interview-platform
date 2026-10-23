# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGapGeneratorWorker do
  let(:portfolio) { create(:portfolio) }
  let(:vacancy)   { create(:vacancy) }
  let(:engine)    { instance_double(FitGap::Engine) }

  before { allow(FitGap::Engine).to receive(:new).and_return(engine) }

  it 'treats losing a race with a duplicate job as success, updating the row the other job created' do
    calls = 0
    allow(engine).to receive(:call) do
      calls += 1
      raise ActiveRecord::RecordNotUnique, 'duplicate key' if calls == 1
    end

    expect { described_class.new.perform(portfolio.id, vacancy.id) }.not_to raise_error
    expect(calls).to eq(2)
  end

  it 'produces one report however many times it runs' do
    allow(FitGap::Engine).to receive(:new).and_call_original
    allow(Gemini::HttpClient).to receive(:new).and_return(double(generate_content: {}))
    create(:vacancy_skill, vacancy: vacancy, skill_label: 'SQL')

    3.times { described_class.new.perform(portfolio.id, vacancy.id) }

    expect(FitGapReport.where(portfolio: portfolio, vacancy: vacancy).count).to eq(1)
  end

  it 'lets other failures reach Sidekiq so the job is retried' do
    allow(engine).to receive(:call).and_raise(Gemini::HttpClient::TimeoutError, 'timeout')

    expect { described_class.new.perform(portfolio.id, vacancy.id) }.to raise_error(Gemini::HttpClient::TimeoutError)
  end

  it 'does nothing when the portfolio no longer exists' do
    expect { described_class.new.perform(0, vacancy.id) }.not_to raise_error
  end
end
