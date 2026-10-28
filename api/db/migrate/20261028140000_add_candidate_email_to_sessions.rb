# frozen_string_literal: true

# Sessions were attributed to a person only by the free-text `candidate_name` the
# assessor typed at invite time, so a candidate account had no way to find "their"
# interviews: the dashboard could not tell an upcoming interview from somebody
# else's. This adds an explicit owner key, matched against the signed-in user's
# email, so interviews can be listed — and only for the candidate they belong to.
class AddCandidateEmailToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :candidate_email, :string, limit: 255
    add_index  :sessions, :candidate_email
  end
end
