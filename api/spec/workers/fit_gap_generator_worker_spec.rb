# frozen_string_literal: true

require 'rails_helper'

RSpec.describe FitGapGeneratorWorker do
  let!(:tenant)       { create(:organization, scheme: 'test-corp',  identifier: 'test-corp') }
  let!(:other_tenant) { create(:organization, scheme: 'other-corp', identifier: 'other-corp') }

  let(:portfolio) { with_tenant(tenant) { create(:portfolio, :with_skills, skill_count: 1) } }

  it 'generates a report when the portfolio and vacancy share a tenant' do
    vacancy = with_tenant(tenant) { create(:vacancy, :with_skills, skill_count: 1) }

    expect { described_class.new.perform(portfolio.id, vacancy.id) }
      .to change(FitGapReport, :count).by(1)
  end

  # A Sidekiq worker has no request context, so TenantScoped degrades to `all`.
  # Nothing else in this process would stop two tenants' data being joined.
  it 'refuses to compare a portfolio and vacancy from different tenants' do
    foreign_vacancy = with_tenant(other_tenant) { create(:vacancy, :with_skills, skill_count: 1) }

    expect { described_class.new.perform(portfolio.id, foreign_vacancy.id) }
      .not_to change(FitGapReport, :count)
  end

  it 'does not retry a cross-tenant pair, which can never become valid' do
    foreign_vacancy = with_tenant(other_tenant) { create(:vacancy, :with_skills, skill_count: 1) }

    expect { described_class.new.perform(portfolio.id, foreign_vacancy.id) }.not_to raise_error
  end
end
