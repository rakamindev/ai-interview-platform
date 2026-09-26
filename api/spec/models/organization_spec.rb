# frozen_string_literal: true

require "rails_helper"

# assessment/gap-analysis.md P0-6 (org.rb hardening): `search_path` is
# "ai_interview,public" — ai_interview comes first. If anything ever creates
# a stray `ai_interview.organizations` table (e.g. a schema dump/load run
# against an inconsistent migration history — this happened once, by
# accident, during local development), an unqualified table name silently
# starts reading that decoy table instead of the real one in `public`, and
# tenant resolution fails with no indication why (surfaces as a bare 403).
RSpec.describe Organization, type: :model do
  describe "table_name" do
    it "is explicitly schema-qualified so it can't be shadowed by search_path order" do
      expect(described_class.table_name).to eq("public.organizations")
    end
  end

  describe ".identify" do
    let!(:real_org) { create(:organization, scheme: "real-corp") }

    it "finds the real organization by scheme" do
      expect(Organization.identify("real-corp")).to eq(real_org)
    end

    describe "ambiguous identifiers" do
      # org_a's *identifier* equals org_b's *scheme*: the same string matches both.
      let!(:org_a) { create(:organization, name: "A", scheme: "a-scheme", identifier: "shared", host: "a.example.com") }
      let!(:org_b) { create(:organization, name: "B", scheme: "shared", identifier: "b-ident", host: "b.example.com") }

      it "resolves deterministically, preferring scheme over the other columns" do
        results = Array.new(5) { Organization.identify("shared") }

        expect(results).to all(eq(org_b))
      end

      it "prefers scheme even when the scheme match has the lower id (order must not just follow id)" do
        first  = create(:organization, name: "C", scheme: "dup", identifier: "c-ident", host: "c.example.com")
        _later = create(:organization, name: "D", scheme: "d-scheme", identifier: "dup", host: "d.example.com")

        expect(Organization.identify("dup")).to eq(first)
      end

      it "still resolves by host when nothing matches on scheme or identifier" do
        expect(Organization.identify("a.example.com")).to eq(org_a)
      end

      it "returns nil for an unknown identifier instead of some default" do
        expect(Organization.identify("nope")).to be_nil
      end
    end

    it "still finds the real organization even if a decoy table exists in ai_interview schema" do
      ActiveRecord::Base.connection.execute("CREATE SCHEMA IF NOT EXISTS ai_interview")
      ActiveRecord::Base.connection.execute(<<~SQL)
        CREATE TABLE IF NOT EXISTS ai_interview.organizations (
          id bigserial PRIMARY KEY,
          name varchar, scheme varchar, identifier varchar, host varchar,
          alias_hosts varchar[] DEFAULT '{}', config jsonb DEFAULT '{}',
          created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
        )
      SQL

      begin
        expect(Organization.identify("real-corp")).to eq(real_org)
      ensure
        ActiveRecord::Base.connection.execute("DROP TABLE IF EXISTS ai_interview.organizations")
        ActiveRecord::Base.connection.execute("DROP SCHEMA IF EXISTS ai_interview CASCADE")
      end
    end
  end
end
