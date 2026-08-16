# frozen_string_literal: true

FactoryBot.define do
  factory :user do
    organization
    sequence(:email) { |n| "assessor#{n}@example.test" }
    password { 'correct horse battery staple' }
    role     { 'admin' }
  end

  factory :skill_taxonomy do
    sequence(:skill_id)    { |n| "SK-ENG-#{format('%03d', n)}" }
    sequence(:skill_label) { |n| "Taxonomy Skill #{n}" }
    category  { 'engineering' }
    scope_include { 'In scope.' }
    l1_anchor { 'Executes with explicit guidance.' }
    l2_anchor { 'Executes independently on routine scope.' }
    l3_anchor { 'Executes complex, ambiguous scope.' }
    l4_anchor { 'Defines standards and reusable systems.' }
    l5_anchor { 'Org-level authority.' }
  end
end
