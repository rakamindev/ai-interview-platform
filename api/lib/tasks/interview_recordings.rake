# frozen_string_literal: true

namespace :interview_recordings do
  desc 'Remove expired recording objects and mark their metadata as purged'
  task purge_expired: :environment do
    InterviewRecording.where(purged_at: nil).where(expires_at: ...Time.current).find_each do |recording|
      begin
        InterviewRecordings::Storage.new.delete(key: recording.object_key)
      rescue Aws::S3::Errors::NoSuchKey
        # A previous attempt may have deleted the object before failing to mark it.
      end
      recording.update!(purged_at: Time.current)
    end
  end
end
