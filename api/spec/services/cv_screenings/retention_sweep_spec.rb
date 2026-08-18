# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CvScreenings::RetentionSweep do
  def build_entry(created_at:)
    entry = create(:cv_screening_entry, detected_email: 'jordan.example@test.invalid')
    entry.cv_file.attach(
      io: File.open(Rails.root.join('spec/fixtures/files/cv_text_layer.pdf')),
      filename: 'cv_text_layer.pdf', content_type: 'application/pdf'
    )
    entry.update_column(:created_at, created_at)
    entry
  end

  it 'purges the attachment and nulls detected_email for expired entries' do
    entry = build_entry(created_at: 91.days.ago)

    described_class.new(retention_days: 90).call

    entry.reload
    expect(entry.cv_file).not_to be_attached
    expect(entry.detected_email).to be_nil
  end

  it 'leaves entries within the retention window untouched' do
    entry = build_entry(created_at: 10.days.ago)

    described_class.new(retention_days: 90).call

    entry.reload
    expect(entry.cv_file).to be_attached
    expect(entry.detected_email).to eq('jordan.example@test.invalid')
  end
end
