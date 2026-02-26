module Api
  class JobsController < ApplicationController
    before_action :require_auth!

    JOB_CACHE_PREFIX = "job:"

    def show
      payload = Rails.cache.read("#{JOB_CACHE_PREFIX}#{params[:id]}")
      return render json: { error: "Job not found" }, status: :not_found unless payload

      render json: payload
    end
  end
end
