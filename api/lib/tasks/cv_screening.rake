# frozen_string_literal: true

namespace :cv_screening do
  desc 'Purge CV attachments and detected emails older than CV_RETENTION_DAYS (default 90)'
  task purge_expired: :environment do
    CvScreenings::RetentionSweep.new.call
  end
end
