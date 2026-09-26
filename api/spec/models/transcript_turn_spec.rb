# frozen_string_literal: true

require "rails_helper"

RSpec.describe TranscriptTurn, type: :model do
  let(:organization) { create(:organization) }
  let(:session) { create(:session, assessment: create(:assessment, organization: organization)) }
  let(:record) { create(:transcript_turn, session: session) }
  let(:expected_tenant_id) { organization.id }

  include_examples "a tenant scoped child model"
end
