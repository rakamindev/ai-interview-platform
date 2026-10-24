# frozen_string_literal: true

require 'rails_helper'

RSpec.describe PortfolioGeneratorWorker do
  it 'skips silently when the session no longer exists (stale or duplicate job)' do
    expect { described_class.new.perform(0) }.not_to raise_error
  end
end
