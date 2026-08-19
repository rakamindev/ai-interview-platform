require './config/environment'
puts RequestStore.store.inspect
RequestStore.clear!
puts RequestStore.store.inspect
RequestStore.store.delete(:tenant_id)
puts RequestStore.store.inspect
puts Assessment.all.to_sql
