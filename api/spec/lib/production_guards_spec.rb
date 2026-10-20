# frozen_string_literal: true

require 'rails_helper'

RSpec.describe ProductionGuards do
  let(:ready) do
    { 'GEMINI_TIER' => 'paid', 'LOGIN_TENANT_SCHEME' => 'acme', 'APP_BASE_URL' => 'https://interview.example.com' }
  end

  it 'lets production start on the paid tier with a server-set company' do
    expect(described_class.problems(ready)).to be_empty
    expect { described_class.check!(ready) }.not_to raise_error
  end

  it 'refuses the free tier, or no tier at all' do
    [ready.merge('GEMINI_TIER' => 'free'), ready.except('GEMINI_TIER')].each do |env|
      expect { described_class.check!(env) }.to raise_error(/GEMINI_TIER must be 'paid'/)
    end
  end

  it 'refuses to start without a server-set company' do
    [ready.except('LOGIN_TENANT_SCHEME'), ready.merge('LOGIN_TENANT_SCHEME' => '  ')].each do |env|
      expect { described_class.check!(env) }.to raise_error(/LOGIN_TENANT_SCHEME must name/)
    end
  end

  it 'names every problem at once, so one deploy fixes them all' do
    expect(described_class.problems({}).size).to eq(3)
  end

  it 'refuses to start without the web app URL that invite links are built from (P1-15)' do
    [ready.except('APP_BASE_URL'), ready.merge('APP_BASE_URL' => ' ')].each do |env|
      expect { described_class.check!(env) }.to raise_error(/APP_BASE_URL must be/)
    end
  end
end
