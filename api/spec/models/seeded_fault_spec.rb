require 'rails_helper'

RSpec.describe 'Seeded Fault Test', type: :model do
  it 'purposely fails to verify the testing harness is catching logic failures' do
    # This is a seeded fault test requested in Phase 1
    # It ensures that if a logic failure occurs, the test suite accurately reports it as a failure.
    # To fix this, change `false` to `true`.
    expect(true).to eq(false)
  end
end
