# frozen_string_literal: true

require 'rails_helper'

# deliver_later would silently degrade to the in-process :async ActiveJob adapter
# in production (see CvScreeningMailer's own comment, and Phase 4's identical trap
# with Sessions::Creator) — no persistence, no retries, lost on every pod rollout.
# This guard makes sure nobody reaches for it later without realizing why it's wrong.
RSpec.describe 'deliver_later usage' do
  it 'is never called anywhere in app/ (comments mentioning it are fine)' do
    matches = Dir[Rails.root.join('app/**/*.rb')].flat_map do |file|
      File.readlines(file).each_with_index.filter_map do |line, index|
        next if line.strip.start_with?('#')

        "#{file}:#{index + 1}" if line.match?(/\.deliver_later\b/)
      end
    end

    expect(matches).to be_empty, "found .deliver_later in: #{matches.join(', ')}"
  end
end
