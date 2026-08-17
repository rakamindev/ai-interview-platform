# frozen_string_literal: true

FactoryBot.define do
  factory :organization do
    name       { Faker::Company.name }
    scheme     { Faker::Internet.domain_word }
    identifier { scheme }
    host       { 'localhost' }
    alias_hosts { [] }
    config     { {} }
  end
end