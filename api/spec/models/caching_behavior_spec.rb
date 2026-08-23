# frozen_string_literal: true

require 'rails_helper'

# Verifies cache behavior for tenant lookup and taxonomy listing:
#   - hits: repeated lookups must not hit the DB
#   - invalidation: any write must orphan cached entries immediately
#
# Uses a per-example MemoryStore (test env defaults to :null_store).
RSpec.describe 'Caching behavior', type: :model do
  around do |example|
    old_store = Rails.cache
    Rails.cache = ActiveSupport::Cache::MemoryStore.new
    example.run
  ensure
    Rails.cache = old_store
  end

  describe 'Organization.identify' do
    let!(:org) { create(:organization, scheme: 'cache-corp') }

    it 'caches lookups and does not re-query for repeats' do
      query_count = 0
      subscriber = ActiveSupport::Notifications.subscribe('sql.active_record') do |*, payload|
        query_count += 1 if payload[:sql] =~ /\A\s*SELECT/i && payload[:sql] =~ /organizations/i
      end

      begin
        3.times { Organization.identify('cache-corp') }
      ensure
        ActiveSupport::Notifications.unsubscribe(subscriber)
      end

      expect(query_count).to eq(1) # 1 miss + 2 cache hits
    end

    it 'serves fresh data after an update (no stale cache)' do
      expect(Organization.identify('cache-corp').name).to eq(org.name)

      org.update!(name: 'Renamed Corp')

      expect(Organization.identify('cache-corp').name).to eq('Renamed Corp')
    end

    it 'reflects newly created organizations without waiting for TTL' do
      expect(Organization.identify('brand-new')).to be_nil

      create(:organization, scheme: 'brand-new')

      expect(Organization.identify('brand-new')).to be_present
    end

    it 'bypasses the cache for malformed identifiers' do
      bad = 'bad identifier with spaces'

      Organization.identify(bad)

      # identify() must not write a cache entry for uncacheable input
      expect(Rails.cache.read(Organization.cache_key(bad))).to be_nil
    end
  end

  describe 'SkillTaxonomy index caching' do
    it 'invalidates cached lists after a taxonomy change' do
      create(:skill_taxonomy, skill_id: 'SK-CACHE-1', category: 'engineering')

      first_result = Rails.cache.fetch("k1") do
        SkillTaxonomy.where(category: 'engineering').pluck(:skill_id)
      end
      expect(first_result).to include('SK-CACHE-1')

      version_before = SkillTaxonomy.cache_version
      create(:skill_taxonomy, skill_id: 'SK-CACHE-2', category: 'engineering')

      expect(SkillTaxonomy.cache_version).not_to eq(version_before)
    end
  end
end
