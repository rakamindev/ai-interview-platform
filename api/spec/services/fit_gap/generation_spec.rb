# frozen_string_literal: true

require_relative '../../spec_helper'
require 'securerandom'

class FitGapReport
  class << self
    attr_accessor :record
    def find_or_create_by!(*)
      self.record ||= new
    end
  end

  attr_accessor :generation_status, :generation_error, :generation_token

  def initialize
    @generation_status = 'failed'
  end

  def with_lock
    yield
  end

  def failed? = generation_status == 'failed'
  def generating? = generation_status == 'generating'
  def update!(attributes) = attributes.each { |key, value| public_send("#{key}=", value) }
  def reload = self
end

class FitGapGeneratorWorker
  def self.perform_async(*); end
end

require_relative '../../../app/services/fit_gap/generation'

RSpec.describe FitGap::Generation do
  before do
    FitGapReport.record = nil
  end

  it 'coalesces repeated requests while the report is generating' do
    portfolio = double(id: 21)
    vacancy = double(id: 8)
    expect(FitGapGeneratorWorker).to receive(:perform_async).once

    first = described_class.enqueue(portfolio:, vacancy:)
    first_token = first.generation_token
    second = described_class.enqueue(portfolio:, vacancy:)

    expect(first.generation_status).to eq('generating')
    expect(second.generation_token).to eq(first_token)
  end
end
