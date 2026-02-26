module Api
  class GenerateController < ApplicationController
    before_action :require_auth!

    def create
      year = params[:year].to_i
      ry = current_user.review_years.find_by(year: year)
      return render json: { error: "Review year not found" }, status: :not_found unless ry
      return render json: { error: "No evidence collected yet" }, status: :unprocessable_entity if ry.evidence.blank?

      job = GenerateJob.perform_later(ry.id)
      jid = job.provider_job_id || job.job_id
      Rails.cache.write("job:#{jid}", { status: "pending" }, expires_in: 1.hour)
      render json: { job_id: jid }, status: :accepted
    end
  end
end
