require 'rails_helper'

RSpec.describe SystemPromptGeneratorWorker, type: :worker do
  let(:org) { Organization.create!(name: 'Test Org', identifier: 'test-org', scheme: 'test-org', host: 'test-org.local') }
  let(:assessment) { Assessment.create!(name: 'Test', time_limit_min: 45, tenant_id: org.id, created_by: 1, prompt_generation_status: 'pending') }

  it "updates status on success" do
    compiler_double = double(call: "Generated prompt")
    allow(Assessments::SystemPromptCompiler).to receive(:new).with(assessment).and_return(compiler_double)

    subject.perform(assessment.id)

    assessment.reload
    expect(assessment.system_prompt).to eq("Generated prompt")
    expect(assessment.prompt_generation_status).to eq("complete")
    expect(assessment.prompt_generation_error).to be_nil
  end

  it "updates status on failure and raises error" do
    allow(Assessments::SystemPromptCompiler).to receive(:new).with(assessment).and_raise(StandardError.new("API Timeout"))

    expect {
      subject.perform(assessment.id)
    }.to raise_error(StandardError, "API Timeout")

    assessment.reload
    expect(assessment.prompt_generation_status).to eq("failed")
    expect(assessment.prompt_generation_error).to include("API Timeout")
  end
end
