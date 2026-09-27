# frozen_string_literal: true

require 'rails_helper'
require 'rake'

RSpec.describe 'db:seed:e2e rake task' do
  before(:all) do
    Rails.application.load_tasks unless Rake::Task.task_defined?('db:seed:e2e')
  end

  before do
    Rake::Task['db:seed:e2e'].reenable
  end

  it 'seeds organization, assessment, vacancy, and 6 candidate sessions idempotently' do
    expect { Rake::Task['db:seed:e2e'].invoke }.not_to raise_error

    org = Organization.find_by(scheme: 'e2e-corp')
    expect(org).to be_present

    assessment = Assessment.unscoped.find_by(tenant_id: org.id)
    expect(assessment).to be_present
    expect(assessment.language).to eq('id')
    expect(assessment.assessment_skills.count).to eq(5)
    expect(assessment.system_prompt).to be_present

    vacancy = Vacancy.unscoped.find_by(tenant_id: org.id)
    expect(vacancy).to be_present
    expect(vacancy.vacancy_skills.count).to eq(5)

    expected_tokens = %w[
      e2e-token-happy-path
      e2e-token-resumption
      e2e-token-consent-decline
      e2e-token-soft-bypass
      e2e-token-live-gemini
      e2e-token-model-validity
    ]

    sessions = Session.unscoped.where(tenant_id: org.id)
    expect(sessions.pluck(:invite_token)).to match_array(expected_tokens)
    expect(sessions.pluck(:status).uniq).to eq(['pending'])

    # Re-run to verify idempotency
    Rake::Task['db:seed:e2e'].reenable
    expect { Rake::Task['db:seed:e2e'].invoke }.not_to raise_error

    expect(Session.unscoped.where(tenant_id: org.id).count).to eq(6)
    expect(Session.unscoped.where(tenant_id: org.id).pluck(:invite_token)).to match_array(expected_tokens)
  end
end
