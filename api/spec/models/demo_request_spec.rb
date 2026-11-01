# frozen_string_literal: true

require 'rails_helper'

RSpec.describe DemoRequest, :aggregate_failures do
  let(:valid_attributes) do
    { name: 'Sari Wijaya', email: 'sari@example.test', company: 'Example Corp', message: 'Frontend engineers' }
  end

  def sql_log
    output = StringIO.new
    original_logger = ActiveRecord::Base.logger
    ActiveRecord::Base.logger = Logger.new(output, level: :debug)
    yield
    output.string
  ensure
    ActiveRecord::Base.logger = original_logger
  end

  it 'is valid with name, email, and company' do
    expect(described_class.new(valid_attributes.except(:message))).to be_valid
  end

  it 'trims text and stores a blank message as nil' do
    request = described_class.create!(name: '  Sari  ', email: ' sari@example.test ', company: ' Example ',
                                      message: '  ')

    expect(request).to have_attributes(name: 'Sari', email: 'sari@example.test', company: 'Example', message: nil)
  end

  it 'rejects whitespace-only required fields' do
    request = described_class.new(name: '   ', email: '   ', company: '   ')

    expect(request).not_to be_valid
    expect(request.errors.attribute_names).to include(:name, :email, :company)
  end

  it 'rejects a malformed email' do
    expect(described_class.new(valid_attributes.merge(email: 'not-an-email'))).not_to be_valid
  end

  it 'keeps personal data out of the SQL log' do
    log = sql_log { described_class.create!(valid_attributes) }

    expect(log).to include('INSERT INTO "demo_requests"')
    expect(log).not_to include('Sari Wijaya', 'sari@example.test', 'Example Corp', 'Frontend engineers')
  end

  it 'rejects over-long fields' do
    expect(described_class.new(valid_attributes.merge(name: 'a' * 256))).not_to be_valid
    expect(described_class.new(valid_attributes.merge(message: 'a' * 1001))).not_to be_valid
  end
end
