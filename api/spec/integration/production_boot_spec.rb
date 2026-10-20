# frozen_string_literal: true

require 'rails_helper'
require 'open3'

# Boots the app in production mode in a separate process, the way a deploy would. Slow (two boots), but it's the
# only test that sees config/environments/production.rb and the production guards together: production didn't
# boot at all until sub-PR 9, and nothing noticed.
RSpec.describe 'Booting in production' do
  def boot(env)
    # Everything production needs to boot, as dummies, so the result doesn't depend on a local application.yml.
    base = {
      'RAILS_ENV' => 'production', 'SECRET_KEY_BASE' => 'boot-check-only',
      'GEMINI_API_KEY' => 'boot-check-only', 'GEMINI_LIVE_MODEL' => 'none', 'GEMINI_FLASH_MODEL' => 'none',
      'GEMINI_PRO_MODEL' => 'none'
    }
    # Through the Ruby that runs the suite: a checkout made on Windows doesn't keep bin/rails executable.
    out, status = Open3.capture2e(base.merge(env), Gem.ruby, 'bin/rails', 'runner', 'puts "booted"',
                                  chdir: Rails.root.to_s)
    [out, status]
  end

  it 'boots with a paid model tier, a server-set company and the web app URL' do
    out, status = boot('GEMINI_TIER' => 'paid', 'LOGIN_TENANT_SCHEME' => 'acme',
                       'APP_BASE_URL' => 'https://interview.example.com')

    expect(out).to include('booted'), out.lines.grep(/Error|error/).first(3).join
    expect(status).to be_success
  end

  it 'refuses to boot without them, and says why' do
    out, status = boot('GEMINI_TIER' => 'free', 'LOGIN_TENANT_SCHEME' => '')

    expect(status).not_to be_success
    expect(out).to include('Refusing to start in production', "GEMINI_TIER must be 'paid'", 'LOGIN_TENANT_SCHEME must name')
  end
end
