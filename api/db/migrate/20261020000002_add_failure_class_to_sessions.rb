# frozen_string_literal: true

# Records WHICH class of failure broke a session, at a coarser grain than
# end_reason. end_reason collapses every unexpected break into 'error', so an
# assessor seeing `end_reason: 'error'` cannot tell "retry this candidate"
# from "the interview provider is down" from "there is a bug in our code"
# (gap finding #4).
#
# Deliberately a plain string, not a PostgreSQL enum the way end_reason and
# status are. The brief requires every migration to be reversible, and
# PostgreSQL offers no way to take a value back out of an enum — there is no
# ALTER TYPE ... DROP VALUE, confirmed against the 16.15 instance this runs
# on. An enum here would therefore make this migration one-way the moment a
# fifth class is added. add_column / remove_column inverts cleanly, so the
# contract lives in Session::FAILURE_CLASSES instead of in the database.
#
# Nullable on purpose: the overwhelming majority of sessions end normally and
# have no failure to record. NULL means "nothing went wrong", which keeps
# that distinction readable instead of encoding it as an empty string.
class AddFailureClassToSessions < ActiveRecord::Migration[7.0]
  def change
    add_column :sessions, :failure_class, :string
  end
end
