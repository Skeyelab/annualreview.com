module Api
  class CollectController < ApplicationController
    before_action :require_auth!

    def create
      start_date = params[:start_date]
      end_date = params[:end_date]

      unless start_date.present? && end_date.present? &&
             start_date.match?(/\A\d{4}-\d{2}-\d{2}\z/) &&
             end_date.match?(/\A\d{4}-\d{2}-\d{2}\z/)
        return render json: { error: "start_date and end_date must be YYYY-MM-DD" }, status: :bad_request
      end

      job = CollectJob.perform_later(current_user.id, start_date, end_date)
      jid = job.provider_job_id || job.job_id
      Rails.cache.write("job:#{jid}", { status: "pending" }, expires_in: 1.hour)
      render json: { job_id: jid }, status: :accepted
    end
  end
end
