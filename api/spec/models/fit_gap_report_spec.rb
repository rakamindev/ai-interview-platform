# frozen_string_literal: true

require "rails_helper"

RSpec.describe FitGapReport, type: :model do
  let(:organization) { create(:organization) }
  let(:session) { create(:session, assessment: create(:assessment, organization: organization)) }
  let(:portfolio) { create(:portfolio, session: session) }
  let(:record) { create(:fit_gap_report, portfolio: portfolio) }
  let(:expected_tenant_id) { organization.id }

  include_examples "a tenant scoped child model"
end
