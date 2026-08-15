# frozen_string_literal: true

require "rails_helper"

RSpec.describe CoverageMap, type: :model do
  let(:organization) { create(:organization) }
  let(:session) { create(:session, assessment: create(:assessment, organization: organization)) }
  let(:record) { create(:coverage_map, session: session) }
  let(:expected_tenant_id) { organization.id }

  include_examples "a tenant scoped child model"
end
