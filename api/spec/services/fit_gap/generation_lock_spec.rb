# frozen_string_literal: true

require 'rails_helper'

# AC7.2: the lock belongs to whoever acquired it. Releasing with another holder's token, or with
# none, must leave it in place; otherwise a job could free a lock a running job still needs.
RSpec.describe FitGap::GenerationLock do
  it 'hands out a token once, and nothing while the lock is held' do
    token = described_class.acquire(1, 2)

    expect(token).to be_a(String).and be_present
    expect(described_class.acquire(1, 2)).to be_nil
    expect(described_class.held?(1, 2)).to be(true)
  end

  it 'releases only with the token it handed out' do
    token = described_class.acquire(1, 2)

    described_class.release(1, 2, 'someone-else')
    expect(described_class.held?(1, 2)).to be(true)

    described_class.release(1, 2, token)
    expect(described_class.held?(1, 2)).to be(false)
  end

  it 'keeps locks for different pairs independent' do
    described_class.acquire(1, 2)

    expect(described_class.acquire(1, 3)).to be_present
  end
end
