# frozen_string_literal: true
require 'simplecov'

SimpleCov.start 'rails' do
  enable_coverage :branch

  add_filter '/spec/'
  add_filter '/config/'
  add_filter '/db/'

  minimum_coverage line: 0
end