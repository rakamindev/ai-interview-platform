# frozen_string_literal: true

require 'rails_helper'

# Race guard for AC-B3: PortfolioGeneratorWorker must not (re)create a
# portfolio from a session whose consent was revoked (data deletion in flight).
RSpec.describe PortfolioGeneratorWorker, type: :job do
  it 'skips generation when consent is not granted (AC-B3 race guard)' do
    session = create(:session)

    expect(Portfolios::Generator).not_to receive(:new)
    PortfolioGeneratorWorker.new.perform(session.id)
  end

  it 'runs generation when consent is granted' do
    session = create(:session)
    create(:consent, session: session, tenant_id: session.tenant_id)

    generator = instance_double(Portfolios::Generator, call: true)
    expect(Portfolios::Generator).to receive(:new).with(session: session).and_return(generator)

    PortfolioGeneratorWorker.new.perform(session.id)
  end

  it 'skips silently when the session does not exist' do
    expect { PortfolioGeneratorWorker.new.perform(99_999_999) }.not_to raise_error
  end
end