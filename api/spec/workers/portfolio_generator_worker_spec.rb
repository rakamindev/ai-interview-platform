require 'rails_helper'

RSpec.describe PortfolioGeneratorWorker do
  it 'does not expose provider payloads in job exceptions or retry storage' do
    portfolio, = create_review
    allow(Portfolios::Generator).to receive(:new).and_raise(ArgumentError, 'private transcript content')
    expect { described_class.new.perform(portfolio.session_id) }.to raise_error(StandardError) do |error|
      expect(error.message).to eq('Portfolio processing failed')
      expect(error.cause).to be_nil
    end
  end
end
