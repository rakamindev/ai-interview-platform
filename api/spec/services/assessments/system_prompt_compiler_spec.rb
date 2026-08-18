# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Assessments::SystemPromptCompiler do
  let(:assessment_id) { create(:assessment, language: 'id') }
  let(:assessment_en) { create(:assessment, language: 'en') }
  let!(:skill) { create(:assessment_skill, assessment: assessment_id, skill_label: 'Go') }

  it 'injects Bahasa Indonesia language instruction when assessment language is id' do
    compiler = described_class.new(assessment_id)
    prompt = compiler.call
    expect(prompt).to include('LANGUAGE: Conduct this entire interview in Bahasa Indonesia.')
  end

  it 'injects English language instruction when assessment language is en' do
    compiler = described_class.new(assessment_en)
    prompt = compiler.call
    expect(prompt).to include('LANGUAGE: Conduct this entire interview in English.')
  end
end
