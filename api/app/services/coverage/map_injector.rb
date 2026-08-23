# frozen_string_literal: true

require 'digest'

module Coverage
    # Builds the coverage map JSON payload for injection into Gemini Live context.
    # Called synchronously before each AI response — must be < 50ms.
    class MapInjector
        def initialize(session)
            @session = session
        end

        # Returns a fingerprint of coverage state only (excludes time_remaining so
        # a pure clock tick doesn't trigger a redundant re-injection).
        def coverage_fingerprint
            maps = @session.coverage_maps.order(:id)
            Digest::MD5.hexdigest(maps.map { |m| "#{m.id}:#{m.state}:#{m.probe_count}" }.join(','))
        end

        # Returns the formatted injection string to send via realtimeInput.text.
        def injection_text
            maps = @session.coverage_maps.includes(:session)
            configured = maps.configured.order(:id)
            discovered = maps.discovered.order(:id)

            remaining_min = time_remaining_minutes
            skills_left = skills_remaining(configured)
            avg_min = avg_minutes_per_remaining_skill(remaining_min, skills_left)

            payload = {
                skills: configured.map { |m| skill_json(m) },
                discovered: discovered.map { |m| skill_json(m) },
                time_remaining_minutes: remaining_min,
                skills_remaining: skills_left,
                avg_minutes_per_remaining_skill: avg_min,
                pacing: pacing_bucket(avg_min),
                priority_next: priority_next(configured)
            }

            Rails.logger.info("[MapInjector] Coverage map: skills_remaining=#{skills_left} avg_min=#{avg_min} pacing=#{pacing_bucket(avg_min)} priority_next=#{payload[:priority_next]}")

            "[COVERAGE_MAP]\n#{payload.to_json}\n[/COVERAGE_MAP]"
        end

        # Returns true when every configured skill is covered AND no discovered
        # skill is still in initiated state. Used by the audio middleware to decide
        # when it is safe to inject a wrap-up signal and end the session.
        def all_covered?
            maps = @session.coverage_maps
            configured = maps.configured
            discovered = maps.discovered

            return false if configured.empty?
            return false unless configured.all? { |m| m.state == 'covered' }
            return false if discovered.any? { |m| m.state == 'initiated' }

            true
        end

        private

        def skill_json(map)
            {
                id: map.skill_taxonomy.skill_id || map.skill_taxonomy.skill_label.downcase.gsub(/\s+/, '-'),
                label: map.skill_taxonomy.skill_label,
                state: map.state,
                probe_count: map.probe_count
            }
        end

        def skills_remaining(configured_maps)
            configured_maps.count { |m| m.state != 'covered' }
        end

        def avg_minutes_per_remaining_skill(remaining_min, skills_left)
            return nil unless remaining_min
            return remaining_min if skills_left.zero?

            (remaining_min.to_f / skills_left).round(1)
        end

        def pacing_bucket(avg_min)
            return nil unless avg_min

            if avg_min >= 5.0
                'ahead'
            elsif avg_min >= 3.0
                'on_track'
            elsif avg_min >= 1.5
                'behind'
            else
                'critical'
            end
        end

        def time_remaining_minutes
            return nil unless @session.started_at && @session.assessment.time_limit_min

            elapsed_seconds = (Time.current - @session.started_at).to_i
            limit_seconds = @session.assessment.time_limit_min * 60
            remaining = limit_seconds - elapsed_seconds

            [(remaining / 60.0).ceil, 0].max
        end

        # Returns the skill_id/label of the highest-priority uncovered skill.
        # Priority: not_yet > initiated > partial > discovered > covered
        def priority_next(configured_maps)
            priority_order = %w[not_yet initiated partial covered]

            best = configured_maps
                   .reject { |m| m.state == 'covered' }
                   .min_by { |m| priority_order.index(m.state) || 999 }

            return nil unless best

            best.skill_taxonomy.skill_id || best.skill_taxonomy.skill_label.downcase.gsub(/\s+/, '-')
        end
    end
end
