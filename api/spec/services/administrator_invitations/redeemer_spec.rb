# frozen_string_literal: true

require 'rails_helper'

RSpec.describe AdministratorInvitations::Redeemer, type: :service do
  self.use_transactional_tests = false

  before do
    AdministratorInvitation.delete_all
    User.where("email LIKE ?", '%@concurrency.test').delete_all
    Organization.where(identifier: 'admin-invite-concurrency').delete_all
  end

  after do
    AdministratorInvitation.delete_all
    User.where("email LIKE ?", '%@concurrency.test').delete_all
    Organization.where(identifier: 'admin-invite-concurrency').delete_all
  end

  it 'allows at most one redemption when two database connections race' do
    organization = Organization.create!(
      name: 'Concurrency Tenant',
      scheme: 'admin-invite-concurrency',
      identifier: 'admin-invite-concurrency',
      host: 'admin-invite-concurrency.test.local'
    )
    inviter = User.create!(
      email: 'inviter@concurrency.test',
      password: 'Password123!',
      role: 'admin',
      organization:
    )
    invitation, raw_token = AdministratorInvitations::Issuer.call(
      inviter:,
      email: 'recipient@concurrency.test'
    )

    ready = Queue.new
    start = Queue.new
    threads = 2.times.map do
      Thread.new do
        ActiveRecord::Base.connection_pool.with_connection do
          ready << true
          start.pop
          begin
            described_class.call(
              token: raw_token,
              email: 'recipient@concurrency.test',
              password: 'Password123!'
            )
          rescue StandardError => e
            e
          end
        end
      end
    end

    2.times { ready.pop }
    2.times { start << true }
    results = threads.map(&:value)

    expect(results.count { |result| result.is_a?(Array) }).to eq(1)
    expect(results.count { |result| result.is_a?(described_class::InvalidInvitation) }).to eq(1)
    expect(User.where(email: 'recipient@concurrency.test').count).to eq(1)
    expect(invitation.reload.status).to eq('accepted')
  end
end
