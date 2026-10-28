# frozen_string_literal: true

class CreateSessionFeedbacks < ActiveRecord::Migration[7.0]
  def change
    create_table :session_feedbacks do |t|
      t.bigint   :session_id, null: false
      t.bigint   :tenant_id, null: false
      t.integer  :rating, null: false
      t.string   :experience_tag, limit: 50
      t.text     :feedback_text
      t.boolean  :has_complaint, default: false, null: false
      t.text     :complaint_text
      t.datetime :submitted_at, default: -> { 'now()' }, null: false
      t.timestamps
    end

    add_index :session_feedbacks, :session_id, unique: true, name: 'idx_session_feedbacks_session_id'
    add_index :session_feedbacks, :tenant_id, name: 'idx_session_feedbacks_tenant_id'
    add_foreign_key :session_feedbacks, :sessions
    add_check_constraint :session_feedbacks, 'rating >= 1 AND rating <= 5', name: 'chk_feedback_rating'
  end
end

