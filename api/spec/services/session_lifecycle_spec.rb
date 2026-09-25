require 'rails_helper'

RSpec.describe 'Session lifecycle' do
  it 'ends once even with separately loaded session objects' do
    session = assessment_session(organization, status: 'active')
    first = Sessions::EndHandler.new(session)
    second = Sessions::EndHandler.new(Session.find(session.id))
    allow_any_instance_of(Sessions::EndHandler).to receive(:publish_status_update)
    first.call
    second.call
    expect(Portfolio.where(session_id: session.id).count).to eq(1)
    expect(PortfolioGeneratorWorker.jobs.size).to eq(1)
  end

  it 'makes queue outages recoverable through a failed portfolio' do
    session = assessment_session(organization, status: 'active')
    allow(PortfolioGeneratorWorker).to receive(:perform_async).and_raise(Redis::CannotConnectError)
    allow_any_instance_of(Sessions::EndHandler).to receive(:publish_status_update)
    Sessions::EndHandler.new(session).call
    expect(session.reload).to be_ended
    expect(session.portfolio).to be_failed
  end

  it 'does not restart a finished interview' do
    session = assessment_session(organization)
    expect { Sessions::StartHandler.new(session).call }.to raise_error(ArgumentError)
    expect(session.reload).to be_ended
  end
end

RSpec.describe 'Concurrent generation' do
  it 'skips a duplicate while another connection owns the session generation lock' do
    session = assessment_session(organization)
    portfolio_for(session)
    ready = Queue.new
    release = Queue.new
    holder = Thread.new do
      # Transactional fixtures can pin ActiveRecord threads to one connection.
      # Use a real second PostgreSQL session to exercise cross-worker exclusion.
      config = ActiveRecord::Base.connection_db_config.configuration_hash
      connection = PG.connect(host: config[:host], port: config[:port],
                              dbname: config[:database], user: config[:username], password: config[:password])
      key = "portfolio-generation:#{session.id}"
      begin
        connection.exec_params('SELECT pg_advisory_lock(hashtextextended($1, 0))', [key])
        ready << true
        release.pop
      ensure
        connection.close
      end
    end
    ready.pop
    client = instance_double(Gemini::HttpClient)
    expect(client).not_to receive(:generate_content)
    expect(Portfolios::Generator.new(session: session, gemini_client: client).call).to be_nil
  ensure
    release << true if release
    holder&.join
  end
end
