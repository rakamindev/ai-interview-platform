# frozen_string_literal: true

require 'rails_helper'
require 'stringio'

RSpec.describe 'db/seeds.rb' do
  let(:seed_path) { Rails.root.join('db/seeds.rb').to_s }

  # Seeds print a lot, and loading the file twice (idempotency check) re-defines
  # its constants; keep test output clean.
  around do |example|
    original_stdout = $stdout
    original_verbose = $VERBOSE
    $stdout = StringIO.new
    $VERBOSE = nil
    example.run
  ensure
    $stdout = original_stdout
    $VERBOSE = original_verbose
  end

  it 'refuses to run in production' do
    allow(Rails).to receive(:env).and_return(ActiveSupport::StringInquirer.new('production'))

    expect { load seed_path }.not_to change(User, :count)
    expect(User.find_by(email: 'admin@test.com')).to be_nil
  end

  it 'creates a dev admin and organization outside production, idempotently' do
    expect { load seed_path }.to change(User, :count).by_at_least(1)

    admin = User.find_by(email: 'admin@test.com')
    expect(admin&.role).to eq('admin')
    expect(Organization.find_by(scheme: 'test-corp')).to be_present

    # Re-running does not duplicate the admin or the organization.
    expect { load seed_path }.not_to change(User, :count)
    expect(Organization.where(scheme: 'test-corp').count).to eq(1)
  end
end
