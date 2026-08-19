# frozen_string_literal: true

class AddFeedbackTextToCvScreeningEntries < ActiveRecord::Migration[7.0]
  def change
    add_column :cv_screening_entries, :feedback_text, :text
  end
end
