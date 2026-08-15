# frozen_string_literal: true

# JWTs are trusted without a DB lookup (see api/app/auth/authorize_api_request.rb)
# — a deactivated admin keeps full access to every tenant's candidate data
# until their token's 3-day expiry, with no way to cut that off sooner. This
# column plus the check added to AuthorizeApiRequest close that for locally-
# issued admin tokens. See assessment/gap-analysis.md P1-5.
class AddActiveToUsers < ActiveRecord::Migration[7.0]
  def change
    add_column :users, :active, :boolean, default: true, null: false
  end
end
