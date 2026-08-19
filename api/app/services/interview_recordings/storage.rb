# frozen_string_literal: true

module InterviewRecordings
  class Storage
    def initialize
      @bucket = ENV.fetch('INTERVIEW_RECORDINGS_BUCKET', 'interview-recordings')
      @client = Aws::S3::Client.new(
        endpoint: ENV.fetch('S3_ENDPOINT', 'http://localhost:9000'),
        region: ENV.fetch('S3_REGION', 'us-east-1'),
        access_key_id: ENV.fetch('S3_ACCESS_KEY', 'minio'),
        secret_access_key: ENV.fetch('S3_SECRET_KEY', 'minio-local-only'),
        force_path_style: true
      )
    end

    def upload_url(key:, content_type:)
      presigner.presigned_url(:put_object, bucket: @bucket, key:, content_type:, expires_in: 900)
    end

    def playback_url(key:)
      presigner.presigned_url(:get_object, bucket: @bucket, key:, expires_in: 300)
    end

    def delete(key:)
      @client.delete_object(bucket: @bucket, key:)
    end

    private

    def presigner
      @presigner ||= Aws::S3::Presigner.new(client: @client)
    end
  end
end
