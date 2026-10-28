# frozen_string_literal: true

require 'rails_helper'

# Guards the test harness itself: every factory must build a valid record.
RSpec.describe 'factories' do
  FactoryBot.factories.map(&:name).each do |name|
    it "builds a valid #{name}" do
      expect(FactoryBot.create(name)).to be_persisted
    end
  end
end
