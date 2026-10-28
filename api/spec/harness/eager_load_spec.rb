# frozen_string_literal: true

require 'rails_helper'

# Production and CI (CI=true) boot with eager_load enabled. Locally specs run
# lazily, so this spec forces a full eager load to catch constant/file name
# mismatches before they break a deploy.
RSpec.describe 'Application eager loading' do
  it 'loads every autoloaded constant without errors' do
    expect { Rails.application.eager_load! }.not_to raise_error
  end
end
