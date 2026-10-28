# frozen_string_literal: true

require 'rails_helper'

RSpec.describe 'FactoryBot factories' do
  it 'creates a valid record for every factory' do
    expect { FactoryBot.lint }.not_to raise_error
  end
end
