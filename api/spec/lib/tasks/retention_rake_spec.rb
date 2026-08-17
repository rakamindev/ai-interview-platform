# frozen_string_literal: true

require "rails_helper"
require "rake"

RSpec.describe "retention:purge_expired", type: :task do
  let(:org) { create_test_organization }
  let(:assessment) { Current.using(tenant_id: org.id) { create(:assessment) } }

  before(:all) do
    Rails.application.load_tasks unless Rake::Task.task_defined?("retention:purge_expired")
  end

  before do
    Rake::Task["retention:purge_expired"].reenable
  end

  it "purges only sessions past their retention window" do
    expired = Current.using(tenant_id: org.id) do
      create(:session, assessment: assessment, status: "ended", expires_at: 1.day.ago, candidate_name: "Budi")
    end
    not_yet_expired = Current.using(tenant_id: org.id) do
      create(:session, assessment: assessment, status: "ended", expires_at: 1.day.from_now, candidate_name: "Ani")
    end

    Rake::Task["retention:purge_expired"].invoke

    expect(expired.reload.candidate_name).to eq(Session::PURGED_NAME_MARKER)
    expect(not_yet_expired.reload.candidate_name).to eq("Ani")
  end

  it "is idempotent across repeated runs" do
    expired = Current.using(tenant_id: org.id) do
      create(:session, assessment: assessment, status: "ended", expires_at: 1.day.ago, candidate_name: "Budi")
    end

    Rake::Task["retention:purge_expired"].invoke
    Rake::Task["retention:purge_expired"].reenable
    Rake::Task["retention:purge_expired"].invoke

    expect(expired.reload.candidate_name).to eq(Session::PURGED_NAME_MARKER)
  end
end
