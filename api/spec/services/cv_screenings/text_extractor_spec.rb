# frozen_string_literal: true

require 'rails_helper'

RSpec.describe CvScreenings::TextExtractor do
  def attach(fixture_name, content_type: 'application/octet-stream')
    entry = create(:cv_screening_entry)
    entry.cv_file.attach(
      io:           File.open(Rails.root.join('spec/fixtures/files', fixture_name)),
      filename:     fixture_name,
      content_type: content_type
    )
    entry.cv_file
  end

  it 'extracts text from a real text-layer PDF' do
    result = described_class.new(attach('cv_text_layer.pdf')).call

    expect(result.status).to eq(:ok)
    expect(result.text).to include('Fabricated CV content')
    expect(result.char_count).to be > 0
  end

  it 'extracts text from a real DOCX' do
    result = described_class.new(attach('cv_sample.docx')).call

    expect(result.status).to eq(:ok)
    expect(result.text).to include('Fabricated CV content')
  end

  it 'returns :empty_text with reason :no_text_layer for an image-only PDF' do
    result = described_class.new(attach('cv_image_only.pdf')).call

    expect(result.status).to eq(:empty_text)
    expect(result.reason).to eq(:no_text_layer)
  end

  it 'returns :parse_failed with reason :zero_byte for an empty file' do
    result = described_class.new(attach('cv_zero_byte.pdf')).call

    expect(result.status).to eq(:parse_failed)
    expect(result.reason).to eq(:zero_byte)
  end

  it 'returns :parse_failed with reason :corrupt for a truncated PDF' do
    result = described_class.new(attach('cv_truncated.pdf')).call

    expect(result.status).to eq(:parse_failed)
    expect(result.reason).to eq(:corrupt)
  end

  it 'returns :parse_failed with reason :legacy_doc for a real .doc renamed .docx (sniffed by bytes, not extension)' do
    result = described_class.new(attach('cv_legacy_doc.docx')).call

    expect(result.status).to eq(:parse_failed)
    expect(result.reason).to eq(:legacy_doc)
  end

  it 'returns :parse_failed with reason :unsupported_type for a PNG renamed .pdf (sniffed by bytes, not extension)' do
    result = described_class.new(attach('cv_png_renamed.pdf')).call

    expect(result.status).to eq(:parse_failed)
    expect(result.reason).to eq(:unsupported_type)
  end

  it 'returns :parse_failed with reason :encrypted for a password-protected PDF (stubbed — not constructible as a real fixture here)' do
    allow(PDF::Reader).to receive(:new).and_raise(PDF::Reader::EncryptedPDFError.new('encrypted'))

    result = described_class.new(attach('cv_text_layer.pdf')).call

    expect(result.status).to eq(:parse_failed)
    expect(result.reason).to eq(:encrypted)
  end

  it 'returns :parse_failed with reason :too_large for an oversized file, without downloading it' do
    entry = create(:cv_screening_entry)
    entry.cv_file.attach(
      io: File.open(Rails.root.join('spec/fixtures/files/cv_text_layer.pdf')),
      filename: 'cv_text_layer.pdf', content_type: 'application/pdf'
    )
    allow(entry.cv_file).to receive(:byte_size).and_return(described_class::MAX_BYTES + 1)
    allow(entry.cv_file).to receive(:download)

    result = described_class.new(entry.cv_file).call

    expect(result.status).to eq(:parse_failed)
    expect(result.reason).to eq(:too_large)
    expect(entry.cv_file).not_to have_received(:download)
  end

  it 'lets ActiveStorage::FileNotFoundError propagate instead of masquerading as a corrupt file' do
    entry = create(:cv_screening_entry)
    entry.cv_file.attach(
      io: File.open(Rails.root.join('spec/fixtures/files/cv_text_layer.pdf')),
      filename: 'cv_text_layer.pdf', content_type: 'application/pdf'
    )
    allow(entry.cv_file).to receive(:download).and_raise(ActiveStorage::FileNotFoundError)

    expect { described_class.new(entry.cv_file).call }.to raise_error(ActiveStorage::FileNotFoundError)
  end

  it 'raises IncompleteDownloadError (not :parse_failed) when the download is shorter than the recorded byte_size' do
    entry = create(:cv_screening_entry)
    entry.cv_file.attach(
      io: File.open(Rails.root.join('spec/fixtures/files/cv_text_layer.pdf')),
      filename: 'cv_text_layer.pdf', content_type: 'application/pdf'
    )
    allow(entry.cv_file).to receive(:download).and_return('truncated mid-transfer')

    expect { described_class.new(entry.cv_file).call }
      .to raise_error(described_class::IncompleteDownloadError)
  end

  it 'lets a totally unrecognized internal error propagate rather than guessing the file is corrupt' do
    # Only PDF::Reader's/Zip's own named exceptions (rescued locally in
    # extract_pdf/extract_docx) are trusted to mean "this file is genuinely
    # unreadable." Anything else — like this stubbed error — has no principled
    # basis to be labeled :corrupt, so it propagates instead, letting Sidekiq's
    # own retry (and, if exhausted, its always-safe needs_review fallback) be
    # the actual safety net. See the class-level comment for why: production
    # observed bare, unnamed errors from deep inside pdf-reader that never
    # reproduced on a retry against the same stored bytes — i.e. transient, not
    # a real file problem.
    entry = create(:cv_screening_entry)
    entry.cv_file.attach(
      io: File.open(Rails.root.join('spec/fixtures/files/cv_text_layer.pdf')),
      filename: 'cv_text_layer.pdf', content_type: 'application/pdf'
    )
    allow(Marcel::MimeType).to receive(:for).and_raise(ArgumentError, 'boom')

    expect { described_class.new(entry.cv_file).call }.to raise_error(ArgumentError, 'boom')
  end
end
