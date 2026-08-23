# frozen_string_literal: true

# .irbrc — loaded automatically by `rails console`
# Prints ready-to-use test tokens on startup so you can copy-paste immediately.

if defined?(Rails) && Rails.env.development?
    puts ''
    puts '╔══════════════════════════════════════════════════════════════════╗'
    puts '║              AI Interview — Dev Console Helpers                  ║'
    puts '╚══════════════════════════════════════════════════════════════════╝'
    puts ''

    # Find all available organizations so the developer knows what schemes exist
    begin
        orgs = ActiveRecord::Base.connection.select_all(
            'SELECT id, name, scheme FROM public.organizations WHERE id != 0 AND discarded_at IS NULL ORDER BY id LIMIT 10'
        ).to_a

        if orgs.empty?
            puts '  ⚠  No organizations found in public.organizations.'
            puts '     Run `rails db:seed` first to create a test organization.'
        else
            puts '  Available tenants (from public.organizations):'
            puts ''
            orgs.each do |org|
                puts "    id=#{org['id'].to_s.ljust(4)} scheme=#{org['scheme'].ljust(20)} name=#{org['name']}"
            end
            puts ''

            # Auto-mint tokens for the first org
            first = orgs.first
            scheme = first['scheme']

            admin_token   = JsonWebToken.encode({ user_id: 1, role: 'admin',   scheme: scheme })
            student_token = JsonWebToken.encode({ user_id: 2, role: 'student', scheme: scheme })

            puts "  Ready-to-use tokens for scheme='#{scheme}':"
            puts ''
            puts '  ADMIN TOKEN (use for assessor routes):'
            puts "  #{admin_token}"
            puts ''
            puts '  STUDENT TOKEN (use for candidate routes):'
            puts "  #{student_token}"
            puts ''
            puts '  Quick helpers available in this console:'
            puts ''
            puts "    mint(role: 'admin',   scheme: '#{scheme}', user_id: 1)  → JWT string"
            puts "    org(scheme: '#{scheme}')                                 → Organization record"
            puts "    header(role: 'admin', scheme: '#{scheme}')               → curl -H string"
            puts ''
        end
    rescue StandardError => e
        puts "  ⚠  Could not load organizations: #{e.message}"
        puts '     Is the database running and migrated?'
    end

    puts '══════════════════════════════════════════════════════════════════════'
    puts ''

    # ── Helper methods available in the console session ──────────────────────

    # Mint a JWT with any claims you want.
    #
    # Examples:
    #   mint                                      # admin for first org
    #   mint(role: 'student', user_id: 99)
    #   mint(scheme: 'other-corp', role: 'admin')
    def mint(user_id: 1, role: 'admin', scheme: nil, **extra)
        scheme ||= begin
            ActiveRecord::Base.connection
                              .select_value('SELECT scheme FROM public.organizations WHERE id != 0 AND discarded_at IS NULL ORDER BY id LIMIT 1')
        rescue StandardError
            'unknown'
        end

        payload = { user_id: user_id, role: role, scheme: scheme }.merge(extra)
        token = JsonWebToken.encode(payload)
        puts token
        token
    end

    # Look up an Organization record.
    #
    # Examples:
    #   org                         # first non-default org
    #   org(scheme: 'test-corp')
    def org(scheme: nil)
        if scheme
            Organization.identify(scheme)
        else
            Organization.where.not(id: 0).first
        end
    end

    # Print a ready-to-paste curl Authorization header.
    #
    # Examples:
    #   header
    #   header(role: 'student', user_id: 5)
    def header(**opts)
        token = mint(**opts)
        h = "Authorization: Bearer #{token}"
        puts ''
        puts "  curl -H '#{h}' http://localhost:3001/api/v1/assessments"
        puts ''
        h
    end
end
