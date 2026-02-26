class ApplicationJob < ActiveJob::Base
  around_perform do |_job, block|
    block.call
  rescue StandardError => e
    Rails.cache.write("job:#{job_id}", { status: "failed", error: e.message }, expires_in: 1.hour)
    raise
  end
end
