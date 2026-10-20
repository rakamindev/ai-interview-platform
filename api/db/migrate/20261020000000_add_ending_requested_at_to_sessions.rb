# frozen_string_literal: true

# When the server told the candidate page to finish the interview (preparing_to_end): from then on the page may end it
# with audio_complete, and before then it may not (P1-10). Null for every existing session.
class AddEndingRequestedAtToSessions < ActiveRecord::Migration[8.1]
  def change
    add_column :sessions, :ending_requested_at, :datetime
  end
end
